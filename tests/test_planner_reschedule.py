from datetime import datetime, timedelta

import pytest
from sqlmodel import Session, SQLModel, create_engine

from backend.app.models import Session as WorkSession
from backend.app.models import SessionStatus, Task
from backend.app.planner import PlannerService
from backend.app.schemas import ScheduleCreate

TEST_USER_ID = 1


def _memory_db() -> Session:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _create_task(db: Session) -> Task:
    task = Task(
        title="Execution Block",
        objective="Move the session to a new slot",
        category="Planner",
        long_term_goal="Stay coherent across devices",
        priority=3,
        user_id=TEST_USER_ID,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def test_update_planned_session_allows_reschedule_during_the_current_window() -> None:
    with _memory_db() as db:
        task = _create_task(db)
        now = datetime.now().replace(microsecond=0)
        session = WorkSession(
            task_id=task.id,
            planned_start=now - timedelta(minutes=10),
            planned_end=now + timedelta(minutes=50),
            status=SessionStatus.planned,
            user_id=TEST_USER_ID,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        payload = ScheduleCreate(
            task_id=task.id,
            start_time=now + timedelta(hours=2),
            end_time=now + timedelta(hours=3),
            timezone="Africa/Johannesburg",
            notes="Move this block to later today",
            goal_context="Stay coherent across devices",
        )

        updated = PlannerService().update_planned_session(
            db,
            session.id,
            payload,
            TEST_USER_ID,
        )

        assert updated.planned_start == payload.start_time
        assert updated.planned_end == payload.end_time
        assert updated.output_notes == "Move this block to later today"


def test_update_planned_session_rejects_reschedule_after_the_window_has_ended() -> None:
    with _memory_db() as db:
        task = _create_task(db)
        now = datetime.now().replace(microsecond=0)
        session = WorkSession(
            task_id=task.id,
            planned_start=now - timedelta(hours=2),
            planned_end=now - timedelta(hours=1),
            status=SessionStatus.planned,
            user_id=TEST_USER_ID,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        payload = ScheduleCreate(
            task_id=task.id,
            start_time=now + timedelta(hours=2),
            end_time=now + timedelta(hours=3),
            timezone="Africa/Johannesburg",
            notes="Attempt to revive an expired session",
        )

        with pytest.raises(ValueError, match="Only pending sessions can be rescheduled"):
            PlannerService().update_planned_session(
                db,
                session.id,
                payload,
                TEST_USER_ID,
            )


def test_update_planned_session_rejects_new_start_times_in_the_past() -> None:
    with _memory_db() as db:
        task = _create_task(db)
        now = datetime.now().replace(microsecond=0)
        session = WorkSession(
            task_id=task.id,
            planned_start=now + timedelta(minutes=15),
            planned_end=now + timedelta(hours=1, minutes=15),
            status=SessionStatus.planned,
            user_id=TEST_USER_ID,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        payload = ScheduleCreate(
            task_id=task.id,
            start_time=now - timedelta(minutes=5),
            end_time=now + timedelta(minutes=55),
            timezone="Africa/Johannesburg",
            notes="Invalid reschedule into the past",
        )

        with pytest.raises(ValueError, match="Rescheduled sessions must start in the future"):
            PlannerService().update_planned_session(
                db,
                session.id,
                payload,
                TEST_USER_ID,
            )
