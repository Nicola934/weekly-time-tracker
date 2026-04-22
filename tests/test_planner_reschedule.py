from datetime import datetime, timedelta

import pytest
from sqlmodel import Session, SQLModel, create_engine

from backend.app.models import Session as WorkSession
from backend.app.models import SessionStatus, Task, UserAccount
from backend.app.planner import PlannerService
from backend.app.schemas import ScheduleCreate


def _memory_db() -> Session:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _create_user(db: Session, email: str = "planner@example.com") -> UserAccount:
    user = UserAccount(
        name="Planner",
        email=email,
        password_hash="hash",
        password_salt="salt",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _create_task(db: Session, user_id: int, title: str = "Execution Block") -> Task:
    task = Task(
        title=title,
        objective="Protect the weekly plan",
        category="Planning",
        long_term_goal="Stable planner",
        priority=3,
        user_id=user_id,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def _create_planned_session(
    db: Session,
    *,
    user_id: int,
    task_id: int,
    start_time: datetime,
    end_time: datetime,
) -> WorkSession:
    session = WorkSession(
        user_id=user_id,
        task_id=task_id,
        planned_start=start_time,
        planned_end=end_time,
        status=SessionStatus.planned,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def test_create_schedule_rejects_overlapping_session_ranges() -> None:
    with _memory_db() as db:
        user = _create_user(db)
        task = _create_task(db, user.id)
        future_day = datetime.now().replace(microsecond=0) + timedelta(days=2)
        start_time = future_day.replace(hour=9, minute=0, second=0)
        end_time = future_day.replace(hour=10, minute=0, second=0)
        _create_planned_session(
            db,
            user_id=user.id,
            task_id=task.id,
            start_time=start_time,
            end_time=end_time,
        )

        with pytest.raises(
            ValueError,
            match="Session overlaps with an existing scheduled block",
        ):
            PlannerService().create_schedule_block(
                db,
                ScheduleCreate(
                    task_id=task.id,
                    start_time=future_day.replace(hour=9, minute=30, second=0),
                    end_time=future_day.replace(hour=10, minute=30, second=0),
                    timezone="Africa/Johannesburg",
                    notes="Conflicting block",
                ),
                user.id,
            )


def test_update_planned_session_rejects_overlapping_reschedule() -> None:
    with _memory_db() as db:
        user = _create_user(db, "planner-update@example.com")
        task = _create_task(db, user.id)
        future_day = datetime.now().replace(microsecond=0) + timedelta(days=3)
        existing = _create_planned_session(
            db,
            user_id=user.id,
            task_id=task.id,
            start_time=future_day.replace(hour=11, minute=0, second=0),
            end_time=future_day.replace(hour=12, minute=0, second=0),
        )
        target = _create_planned_session(
            db,
            user_id=user.id,
            task_id=task.id,
            start_time=future_day.replace(hour=13, minute=0, second=0),
            end_time=future_day.replace(hour=14, minute=0, second=0),
        )

        with pytest.raises(
            ValueError,
            match="Session overlaps with an existing scheduled block",
        ):
            PlannerService().update_planned_session(
                db,
                target.id,
                ScheduleCreate(
                    task_id=task.id,
                    start_time=future_day.replace(hour=11, minute=30, second=0),
                    end_time=future_day.replace(hour=12, minute=30, second=0),
                    timezone="Africa/Johannesburg",
                    notes="Rescheduled into conflict",
                ),
                user.id,
            )

        db.refresh(existing)
        db.refresh(target)
        assert existing.planned_start.hour == 11
        assert target.planned_start.hour == 13


def test_update_planned_session_allows_non_overlapping_reschedule() -> None:
    with _memory_db() as db:
        user = _create_user(db, "planner-valid@example.com")
        task = _create_task(db, user.id)
        future_day = datetime.now().replace(microsecond=0) + timedelta(days=4)
        _create_planned_session(
            db,
            user_id=user.id,
            task_id=task.id,
            start_time=future_day.replace(hour=9, minute=0, second=0),
            end_time=future_day.replace(hour=10, minute=0, second=0),
        )
        target = _create_planned_session(
            db,
            user_id=user.id,
            task_id=task.id,
            start_time=future_day.replace(hour=11, minute=0, second=0),
            end_time=future_day.replace(hour=12, minute=0, second=0),
        )

        updated = PlannerService().update_planned_session(
            db,
            target.id,
            ScheduleCreate(
                task_id=task.id,
                start_time=future_day.replace(hour=12, minute=30, second=0),
                end_time=future_day.replace(hour=13, minute=30, second=0),
                timezone="Africa/Johannesburg",
                notes="Moved later safely",
            ),
            user.id,
        )

        assert updated.id == target.id
        assert updated.planned_start.hour == 12
        assert updated.planned_start.minute == 30
        assert updated.planned_end.hour == 13
        assert updated.planned_end.minute == 30
