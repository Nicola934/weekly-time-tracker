from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, select

from .models import MissedHabit, Session as WorkSession, SessionQualityLabel, SessionStatus, Task
from .ownership import get_owned_record, require_owned_record
from .schemas import HabitPattern, SessionMissedRequest

START_WINDOW_LEAD = timedelta(hours=1)


def _comparable_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=None) if value.tzinfo else value


class BehaviorService:
    def record_missed_session(
        self,
        db: Session,
        payload: SessionMissedRequest,
        user_id: int,
    ) -> MissedHabit:
        session = require_owned_record(
            db,
            WorkSession,
            payload.session_id,
            user_id,
            "Session not found",
        )
        if session.status == SessionStatus.missed:
            raise ValueError("Session is already marked missed")
        if session.status != SessionStatus.planned:
            raise ValueError("Only planned sessions can be marked missed")
        reference_time = _comparable_datetime(datetime.now().replace(microsecond=0))
        planned_start = _comparable_datetime(session.planned_start)
        if planned_start and reference_time and reference_time < planned_start - START_WINDOW_LEAD:
            raise ValueError(
                "Sessions can only be marked missed within the start window or after start time"
            )

        session.status = SessionStatus.missed
        session.objective_completed = False
        session.objective_locked = True
        session.quality_score = 0
        session.quality_label = SessionQualityLabel.failed
        habit = MissedHabit(
            user_id=user_id,
            session_id=session.id,
            task_id=session.task_id,
            reason_category=payload.reason_category,
            custom_reason=payload.custom_reason,
            captured_at=session.planned_end or datetime.now(UTC),
            time_lost_minutes=payload.time_lost_minutes,
        )
        db.add(habit)
        db.add(session)
        db.commit()
        db.refresh(habit)
        return habit

    def weekly_patterns(
        self,
        db: Session,
        period_start: datetime,
        period_end: datetime,
        user_id: int,
    ) -> list[HabitPattern]:
        habits = list(
            db.exec(
                select(MissedHabit).where(
                    MissedHabit.user_id == user_id,
                    MissedHabit.captured_at >= period_start,
                    MissedHabit.captured_at <= period_end,
                )
            ).all()
        )

        grouped: dict[str, dict[str, int]] = defaultdict(lambda: {"count": 0, "minutes_lost": 0})
        for habit in habits:
            key = (
                habit.custom_reason
                if habit.reason_category.value == "Custom" and habit.custom_reason
                else habit.reason_category.value
            )
            grouped[key]["count"] += 1
            grouped[key]["minutes_lost"] += habit.time_lost_minutes

        return [
            HabitPattern(
                category=category,
                count=data["count"],
                minutes_lost=data["minutes_lost"],
            )
            for category, data in sorted(
                grouped.items(),
                key=lambda item: (-item[1]["minutes_lost"], -item[1]["count"], item[0]),
            )
        ]

    def identify_behavior_risks(
        self,
        db: Session,
        period_start: datetime,
        period_end: datetime,
        user_id: int,
    ) -> list[str]:
        patterns = self.weekly_patterns(db, period_start, period_end, user_id)
        risks: list[str] = []
        if patterns:
            top = patterns[0]
            risks.append(f"You frequently miss sessions due to {top.category}.")

        sessions = list(
            db.exec(
                select(WorkSession).where(
                    WorkSession.user_id == user_id,
                    WorkSession.planned_start >= period_start,
                    WorkSession.planned_end <= period_end,
                    WorkSession.status == SessionStatus.missed,
                )
            ).all()
        )
        if sessions:
            buckets: dict[int, int] = defaultdict(int)
            for item in sessions:
                buckets[item.planned_start.hour] += 1
            top_hour = max(buckets.items(), key=lambda entry: entry[1])[0]
            risks.append(f"Most missed sessions occur during the {top_hour:02d}:00 hour.")

        return risks

    def missed_session_prompt(self, session: WorkSession, task: Task | None) -> dict[str, str | int | None]:
        return {
            "message": "What were you doing instead?",
            "session_id": session.id,
            "task_title": task.title if task else None,
        }
