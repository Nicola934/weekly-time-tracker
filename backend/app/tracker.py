from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlmodel import Session, select

from .metrics import (
    calculate_lateness,
    calculate_session_quality,
    calculate_start_delta,
    minutes_between,
)
from .models import (
    MissedHabit,
    MissedReasonCategory,
    ScheduleBlock,
    Session as WorkSession,
    SessionQualityLabel,
    SessionStatus,
    Task,
)
from .notifier import resolve_task_default_goal
from .schemas import SessionEndRequest, SessionStartRequest

START_WINDOW_LEAD = timedelta(hours=1)


def _comparable_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=None) if value.tzinfo else value


def _current_timestamp() -> datetime:
    return datetime.now().replace(microsecond=0)


def _is_within_start_window(
    planned_start: datetime | None,
    effective_start: datetime | None,
) -> bool:
    comparable_planned_start = _comparable_datetime(planned_start)
    comparable_effective_start = _comparable_datetime(effective_start)
    if comparable_planned_start is None or comparable_effective_start is None:
        return False

    return comparable_effective_start >= comparable_planned_start - START_WINDOW_LEAD


def _normalize_quality_label(label: SessionQualityLabel | str) -> SessionQualityLabel:
    normalized = (
        label.value if hasattr(label, "value") else str(label or "")
    ).strip().lower()
    return SessionQualityLabel(normalized)


class TrackerService:
    def _task_objective(self, db: Session, task_id: int) -> str | None:
        task = db.get(Task, task_id)
        if task and task.objective and task.objective.strip():
            return task.objective.strip()
        return None

    def _session_objective(self, db: Session, session: WorkSession) -> str | None:
        if session.objective and session.objective.strip():
            return session.objective.strip()
        if session.output_notes and session.output_notes.strip():
            return session.output_notes.strip()
        return self._task_objective(db, session.task_id)

    def sync_overdue_sessions(
        self,
        db: Session,
        reference: datetime | None = None,
    ) -> int:
        now = _comparable_datetime(reference or _current_timestamp())
        overdue_sessions = [
            item
            for item in db.exec(
                select(WorkSession).where(WorkSession.status == SessionStatus.planned)
            ).all()
            if _comparable_datetime(item.planned_end)
            and _comparable_datetime(item.planned_end) < now
        ]
        if not overdue_sessions:
            return 0

        existing_habits = {
            item.session_id
            for item in db.exec(
                select(MissedHabit).where(
                    MissedHabit.session_id.in_([item.id for item in overdue_sessions])
                )
            ).all()
        }
        updated = 0
        for session in overdue_sessions:
            session.status = SessionStatus.missed
            session.objective_completed = False
            session.objective_locked = True
            session.start_delta_minutes = (
                session.start_delta_minutes
                if session.start_delta_minutes is not None
                else calculate_start_delta(session.planned_start, session.actual_start)
            )
            session.quality_score = 0
            session.quality_label = _normalize_quality_label(SessionQualityLabel.failed)
            db.add(session)

            if session.id not in existing_habits:
                db.add(
                    MissedHabit(
                        session_id=session.id,
                        task_id=session.task_id,
                        reason_category=MissedReasonCategory.unknown,
                        captured_at=session.planned_end or reference or datetime.now(UTC),
                        time_lost_minutes=int(
                            round(minutes_between(session.planned_start, session.planned_end))
                        ),
                    )
                )
            updated += 1

        db.commit()
        return updated

    def start_session(self, db: Session, payload: SessionStartRequest) -> WorkSession:
        self.sync_overdue_sessions(db, payload.actual_start)
        session = None
        effective_start = payload.actual_start or _current_timestamp()

        if payload.session_id:
            session = db.get(WorkSession, payload.session_id)
        elif payload.schedule_block_id:
            session = db.exec(
                select(WorkSession).where(
                    WorkSession.schedule_block_id == payload.schedule_block_id
                )
            ).first()

        active_session = db.exec(
            select(WorkSession).where(WorkSession.status == SessionStatus.active)
        ).first()
        if active_session and (not session or active_session.id != session.id):
            raise ValueError("Another session is already active")

        if session:
            if session.status == SessionStatus.active:
                return session

            if session.status != SessionStatus.planned:
                raise ValueError("Only planned sessions can be started")

            planned_start = _comparable_datetime(session.planned_start)
            planned_end = _comparable_datetime(session.planned_end)
            comparable_start = _comparable_datetime(effective_start)
            if not _is_within_start_window(session.planned_start, effective_start):
                raise ValueError(
                    "Sessions can only be started within 60 minutes of their planned start"
                )
            if planned_end and planned_end < comparable_start:
                raise ValueError("Past sessions are locked for review")

            session.actual_start = effective_start
            session.status = SessionStatus.active
            session.objective = self._session_objective(db, session)
            session.start_delta_minutes = calculate_start_delta(
                session.planned_start,
                session.actual_start,
            )
            session.timezone = payload.timezone
            db.add(session)
            db.commit()
            db.refresh(session)
            return session

        planned_start = effective_start
        planned_end = planned_start

        if payload.schedule_block_id:
            block = db.get(ScheduleBlock, payload.schedule_block_id)
            if not block:
                raise ValueError("Schedule block not found")
            planned_start = block.start_time
            planned_end = block.end_time
            comparable_start = _comparable_datetime(effective_start)
            if not _is_within_start_window(planned_start, effective_start):
                raise ValueError(
                    "Sessions can only be started within 60 minutes of their planned start"
                )
            if _comparable_datetime(planned_end) and _comparable_datetime(planned_end) < comparable_start:
                raise ValueError("Past sessions are locked for review")

        session = WorkSession(
            task_id=payload.task_id,
            schedule_block_id=payload.schedule_block_id,
            planned_start=planned_start,
            planned_end=planned_end,
            actual_start=effective_start,
            status=SessionStatus.active,
            objective=self._task_objective(db, payload.task_id),
            goal_context=resolve_task_default_goal(db.get(Task, payload.task_id)),
            start_delta_minutes=calculate_start_delta(planned_start, effective_start),
            timezone=payload.timezone,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def end_session(self, db: Session, payload: SessionEndRequest) -> WorkSession:
        session = db.get(WorkSession, payload.session_id)
        if not session:
            raise ValueError("Session not found")

        if session.status == SessionStatus.completed and session.objective_locked:
            return session

        if session.status != SessionStatus.active:
            raise ValueError("Only active sessions can be ended")
        if not payload.objective_completed and payload.failure_reason is None:
            raise ValueError("A failure reason is required when the objective was not completed")
        if (
            payload.failure_reason
            and payload.failure_reason.value == "Other"
            and not str(payload.failure_reason_detail or "").strip()
        ):
            raise ValueError("Provide a short detail when the reason is Other")

        session.actual_end = payload.actual_end or _current_timestamp()
        session.objective_completed = bool(payload.objective_completed)
        session.objective_locked = True
        session.completion_percent = (
            100 if payload.objective_completed else payload.completion_percent
        )
        if payload.output_notes.strip():
            session.output_notes = payload.output_notes.strip()
        session.reflection_notes = payload.reflection_notes.strip()
        session.failure_reason = None if payload.objective_completed else payload.failure_reason
        session.failure_reason_detail = (
            None
            if payload.objective_completed
            else str(payload.failure_reason_detail or "").strip() or None
        )
        session.distraction_category = (
            None
            if payload.objective_completed
            else str(payload.distraction_category or "").strip() or None
        )
        session.start_delta_minutes = (
            session.start_delta_minutes
            if session.start_delta_minutes is not None
            else calculate_start_delta(session.planned_start, session.actual_start)
        )
        session.quality_score, quality_label = calculate_session_quality(session)
        session.quality_label = _normalize_quality_label(quality_label)
        session.status = SessionStatus.completed
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def delete_session(self, db: Session, session_id: int) -> dict[str, int | None]:
        self.sync_overdue_sessions(db)
        session = db.get(WorkSession, session_id)
        if not session:
            raise ValueError("Session not found")

        if session.status == SessionStatus.active:
            raise ValueError("Active sessions cannot be deleted")

        if session.status != SessionStatus.planned:
            raise ValueError("Only planned sessions can be deleted")
        if _comparable_datetime(session.planned_start) <= _comparable_datetime(_current_timestamp()):
            raise ValueError("Only future sessions can be deleted")

        schedule_block_id = session.schedule_block_id
        db.delete(session)

        if schedule_block_id:
            block = db.get(ScheduleBlock, schedule_block_id)
            if block:
                db.delete(block)

        db.commit()
        return {
            "session_id": session_id,
            "schedule_block_id": schedule_block_id,
        }

    def list_sessions(self, db: Session) -> list[WorkSession]:
        self.sync_overdue_sessions(db)
        return list(db.exec(select(WorkSession).order_by(WorkSession.planned_start)).all())

    def punctuality_snapshot(self, session: WorkSession) -> dict[str, float | str]:
        if not session.actual_start:
            return {"status": "pending", "lateness_minutes": 0, "delta_minutes": 0}

        delta_minutes = (
            session.start_delta_minutes
            if session.start_delta_minutes is not None
            else round(
                (session.actual_start - session.planned_start).total_seconds() / 60,
                2,
            )
        )
        if delta_minutes < 0:
            return {
                "status": "early",
                "lateness_minutes": abs(delta_minutes),
                "delta_minutes": delta_minutes,
            }
        if delta_minutes == 0:
            return {"status": "on-time", "lateness_minutes": 0, "delta_minutes": 0}

        lateness = calculate_lateness(session.planned_start, session.actual_start)
        return {"status": "late", "lateness_minutes": lateness, "delta_minutes": delta_minutes}
