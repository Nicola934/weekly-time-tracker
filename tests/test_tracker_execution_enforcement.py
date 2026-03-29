from datetime import datetime, timedelta

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from backend.app.models import MissedHabit, Session as WorkSession, SessionFailureReason, SessionStatus, Task
from backend.app.schemas import SessionEndRequest
from backend.app.tracker import TrackerService


def _memory_db() -> Session:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_end_session_requires_explicit_failure_reason_and_locks_objective() -> None:
    with _memory_db() as db:
        task = Task(
            title="Execution Block",
            objective="Finish the API pass",
            long_term_goal="Backend",
            priority=4,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        session = WorkSession(
            task_id=task.id,
            planned_start=datetime(2026, 3, 26, 10, 0, 0),
            planned_end=datetime(2026, 3, 26, 11, 0, 0),
            actual_start=datetime(2026, 3, 26, 10, 0, 0),
            status=SessionStatus.active,
            objective="Finish the API pass",
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        service = TrackerService()

        with pytest.raises(ValueError):
            service.end_session(
                db,
                SessionEndRequest(
                    session_id=session.id,
                    actual_end=datetime(2026, 3, 26, 11, 0, 0),
                    objective_completed=False,
                    completion_percent=0,
                ),
            )

        ended = service.end_session(
            db,
            SessionEndRequest(
                session_id=session.id,
                actual_end=datetime(2026, 3, 26, 11, 0, 0),
                objective_completed=False,
                completion_percent=0,
                reflection_notes="Handled two endpoints but left validation open.",
                failure_reason=SessionFailureReason.underestimated_effort,
            ),
        )

        assert ended.status == SessionStatus.completed
        assert ended.objective_completed is False
        assert ended.objective_locked is True
        assert ended.start_delta_minutes == 0
        assert ended.quality_score == 60
        assert ended.quality_label.value == "partial"
        assert ended.reflection_notes == "Handled two endpoints but left validation open."
        assert ended.failure_reason == SessionFailureReason.underestimated_effort


def test_overdue_planned_sessions_are_auto_logged_as_missed() -> None:
    with _memory_db() as db:
        task = Task(
            title="System Block",
            objective="Ship backend fixes",
            long_term_goal="Backend",
            priority=4,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        overdue = WorkSession(
            task_id=task.id,
            planned_start=datetime(2026, 3, 24, 14, 0, 0),
            planned_end=datetime(2026, 3, 24, 15, 0, 0),
            status=SessionStatus.planned,
            objective="Ship backend fixes",
        )
        db.add(overdue)
        db.commit()
        db.refresh(overdue)

        updated = TrackerService().sync_overdue_sessions(
            db,
            datetime(2026, 3, 24, 15, 30, 0),
        )

        db.refresh(overdue)
        habits = list(db.exec(select(MissedHabit)).all())

        assert updated == 1
        assert overdue.status == SessionStatus.missed
        assert overdue.objective_locked is True
        assert overdue.quality_score == 0
        assert overdue.quality_label.value == "failed"
        assert len(habits) == 1
        assert habits[0].session_id == overdue.id
