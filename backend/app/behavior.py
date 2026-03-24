from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime

from sqlmodel import Session, select

from .models import MissedHabit, Session as WorkSession, SessionStatus, Task
from .schemas import HabitPattern, SessionMissedRequest


class BehaviorService:
    def record_missed_session(self, db: Session, payload: SessionMissedRequest) -> MissedHabit:
        session = db.get(WorkSession, payload.session_id)
        if not session:
            raise ValueError("Session not found")
        session.status = SessionStatus.missed
        habit = MissedHabit(
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

    def weekly_patterns(self, db: Session, period_start: datetime, period_end: datetime) -> list[HabitPattern]:
        habits = list(
            db.exec(
                select(MissedHabit).where(
                    MissedHabit.captured_at >= period_start,
                    MissedHabit.captured_at <= period_end,
                )
            ).all()
        )
        grouped: dict[str, dict[str, int]] = defaultdict(lambda: {"count": 0, "minutes_lost": 0})
        for habit in habits:
            key = habit.custom_reason if habit.reason_category.value == "Custom" and habit.custom_reason else habit.reason_category.value
            grouped[key]["count"] += 1
            grouped[key]["minutes_lost"] += habit.time_lost_minutes
        return [HabitPattern(category=category, count=data["count"], minutes_lost=data["minutes_lost"]) for category, data in sorted(grouped.items(), key=lambda item: (-item[1]["minutes_lost"], -item[1]["count"], item[0]))]

    def identify_behavior_risks(self, db: Session, period_start: datetime, period_end: datetime) -> list[str]:
        patterns = self.weekly_patterns(db, period_start, period_end)
        risks: list[str] = []
        if patterns:
            top = patterns[0]
            risks.append(f"You frequently miss sessions due to {top.category}.")
        sessions = list(
            db.exec(
                select(WorkSession).where(
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
