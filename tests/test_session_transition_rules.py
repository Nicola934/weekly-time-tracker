from datetime import datetime, timedelta

import pytest
from sqlmodel import Session, SQLModel, create_engine

from backend.app.main import delete_session as delete_session_endpoint
from backend.app.main import delete_session_legacy
from backend.app.behavior import BehaviorService
from backend.app.models import (
    MissedReasonCategory,
    Session as WorkSession,
    SessionStatus,
    Task,
)
from backend.app.schemas import SessionMissedRequest, SessionStartRequest
from backend.app.tracker import TrackerService


def _memory_db() -> Session:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _create_task(db: Session) -> Task:
    task = Task(
        title="Execution Block",
        objective="Finish the narrow fix pass",
        long_term_goal="Backend",
        priority=4,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def test_start_session_allows_a_start_within_the_one_hour_prestart_window() -> None:
    with _memory_db() as db:
        task = _create_task(db)
        session = WorkSession(
            task_id=task.id,
            planned_start=datetime(2026, 3, 26, 10, 0, 0),
            planned_end=datetime(2026, 3, 26, 11, 0, 0),
            status=SessionStatus.planned,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        started = TrackerService().start_session(
            db,
            SessionStartRequest(
                task_id=task.id,
                session_id=session.id,
                actual_start=datetime(2026, 3, 26, 9, 15, 0),
                timezone="Africa/Johannesburg",
            ),
        )

        assert started.status == SessionStatus.active
        assert started.start_delta_minutes == -45
        assert started.actual_start == datetime(2026, 3, 26, 9, 15, 0)


def test_start_session_rejects_a_start_more_than_one_hour_early() -> None:
    with _memory_db() as db:
        task = _create_task(db)
        session = WorkSession(
            task_id=task.id,
            planned_start=datetime(2026, 3, 26, 10, 0, 0),
            planned_end=datetime(2026, 3, 26, 11, 0, 0),
            status=SessionStatus.planned,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        with pytest.raises(ValueError, match="within 60 minutes"):
            TrackerService().start_session(
                db,
                SessionStartRequest(
                    task_id=task.id,
                    session_id=session.id,
                    actual_start=datetime(2026, 3, 26, 8, 59, 0),
                    timezone="Africa/Johannesburg",
                ),
            )


def test_delete_session_allows_future_planned_and_rejects_active_sessions() -> None:
    with _memory_db() as db:
        task = _create_task(db)
        now = datetime.now().replace(microsecond=0)

        future_session = WorkSession(
            task_id=task.id,
            planned_start=now + timedelta(hours=2),
            planned_end=now + timedelta(hours=3),
            status=SessionStatus.planned,
        )
        active_session = WorkSession(
            task_id=task.id,
            planned_start=now - timedelta(minutes=5),
            planned_end=now + timedelta(minutes=55),
            actual_start=now - timedelta(minutes=3),
            status=SessionStatus.active,
        )
        db.add(future_session)
        db.add(active_session)
        db.commit()
        db.refresh(future_session)
        db.refresh(active_session)

        deleted = TrackerService().delete_session(db, future_session.id)
        assert deleted["session_id"] == future_session.id
        assert db.get(WorkSession, future_session.id) is None

        with pytest.raises(ValueError, match="Active sessions cannot be deleted"):
            TrackerService().delete_session(db, active_session.id)


def test_delete_session_legacy_alias_uses_the_same_delete_logic() -> None:
    with _memory_db() as db:
        task = _create_task(db)
        now = datetime.now().replace(microsecond=0)
        session = WorkSession(
            task_id=task.id,
            planned_start=now + timedelta(hours=2),
            planned_end=now + timedelta(hours=3),
            status=SessionStatus.planned,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        deleted = delete_session_legacy(session.id, db)

        assert deleted["deleted"] is True
        assert deleted["session_id"] == session.id
        assert db.get(WorkSession, session.id) is None


def test_delete_session_endpoint_keeps_the_canonical_route_behavior() -> None:
    with _memory_db() as db:
        task = _create_task(db)
        now = datetime.now().replace(microsecond=0)
        session = WorkSession(
            task_id=task.id,
            planned_start=now + timedelta(hours=4),
            planned_end=now + timedelta(hours=5),
            status=SessionStatus.planned,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        deleted = delete_session_endpoint(session.id, db)

        assert deleted["deleted"] is True
        assert deleted["session_id"] == session.id
        assert db.get(WorkSession, session.id) is None


def test_record_missed_session_allows_skip_inside_the_prestart_window() -> None:
    with _memory_db() as db:
        task = _create_task(db)
        now = datetime.now().replace(microsecond=0)
        session = WorkSession(
            task_id=task.id,
            planned_start=now + timedelta(minutes=20),
            planned_end=now + timedelta(minutes=80),
            status=SessionStatus.planned,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        habit = BehaviorService().record_missed_session(
            db,
            SessionMissedRequest(
                session_id=session.id,
                reason_category=MissedReasonCategory.unknown,
                custom_reason="Skipped from notification",
                time_lost_minutes=30,
            ),
        )

        db.refresh(session)
        assert habit.session_id == session.id
        assert session.status == SessionStatus.missed
        assert session.objective_locked is True


def test_record_missed_session_rejects_skips_before_the_prestart_window() -> None:
    with _memory_db() as db:
        task = _create_task(db)
        now = datetime.now().replace(microsecond=0)
        session = WorkSession(
            task_id=task.id,
            planned_start=now + timedelta(hours=2),
            planned_end=now + timedelta(hours=3),
            status=SessionStatus.planned,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        with pytest.raises(ValueError, match="within the start window"):
            BehaviorService().record_missed_session(
                db,
                SessionMissedRequest(
                    session_id=session.id,
                    reason_category=MissedReasonCategory.unknown,
                    custom_reason="Skipped from notification",
                    time_lost_minutes=30,
                ),
            )
