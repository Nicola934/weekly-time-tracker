from datetime import datetime, timedelta

from sqlmodel import Session, SQLModel, create_engine

from backend.app.advisor import AdvisorService
from backend.app.models import Session as WorkSession, SessionStatus, Task, UserAccount, WeeklyProgressMemory


def _memory_db() -> Session:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def _create_user(db: Session) -> UserAccount:
    user = UserAccount(
        name="Operator",
        email="advisor-memory@example.com",
        password_hash="hash",
        password_salt="salt",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_advisor_compares_against_previous_week_memory() -> None:
    week_start = datetime(2026, 3, 23, 0, 0, 0)
    week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)

    with _memory_db() as db:
        user = _create_user(db)
        task = Task(
            title="Backend",
            objective="Advance the backend system",
            long_term_goal="Backend development",
            priority=4,
            user_id=user.id,
        )
        db.add(task)
        db.add(
            WeeklyProgressMemory(
                user_id=user.id,
                week_start=week_start - timedelta(days=7),
                week_end=week_end - timedelta(days=7),
                objective_completion_rate=40,
                completed_objectives=2,
                objective_total=5,
                missed_sessions=3,
                average_quality_score=45,
                weakest_time_bucket="afternoon",
            )
        )
        db.commit()
        db.refresh(task)

        db.add_all(
            [
                WorkSession(
                    task_id=task.id,
                    planned_start=week_start + timedelta(hours=9),
                    planned_end=week_start + timedelta(hours=10),
                    actual_start=week_start + timedelta(hours=9),
                    actual_end=week_start + timedelta(hours=10),
                    status=SessionStatus.completed,
                    objective="Ship backend path A",
                    objective_completed=True,
                    objective_locked=True,
                    completion_percent=100,
                    quality_score=100,
                    quality_label="strong",
                    user_id=user.id,
                ),
                WorkSession(
                    task_id=task.id,
                    planned_start=week_start + timedelta(days=1, hours=9),
                    planned_end=week_start + timedelta(days=1, hours=10),
                    actual_start=week_start + timedelta(days=1, hours=9),
                    actual_end=week_start + timedelta(days=1, hours=10),
                    status=SessionStatus.completed,
                    objective="Ship backend path B",
                    objective_completed=True,
                    objective_locked=True,
                    completion_percent=100,
                    quality_score=100,
                    quality_label="strong",
                    user_id=user.id,
                ),
                WorkSession(
                    task_id=task.id,
                    planned_start=week_start + timedelta(days=2, hours=14),
                    planned_end=week_start + timedelta(days=2, hours=15),
                    status=SessionStatus.missed,
                    objective="Review backend path C",
                    objective_completed=False,
                    objective_locked=True,
                    quality_score=0,
                    quality_label="failed",
                    user_id=user.id,
                ),
                WorkSession(
                    task_id=task.id,
                    planned_start=week_start + timedelta(days=3, hours=15),
                    planned_end=week_start + timedelta(days=3, hours=16),
                    status=SessionStatus.missed,
                    objective="Review backend path D",
                    objective_completed=False,
                    objective_locked=True,
                    quality_score=0,
                    quality_label="failed",
                    user_id=user.id,
                ),
            ]
        )
        db.commit()

        advisory = AdvisorService().generate(db, week_start, week_end, user.id)

    assert any(
        note == "You improved completion rate from 40% to 50%."
        for note in advisory.summary
    )
    assert any(
        note == "This is the second week your afternoon sessions broke down."
        for note in advisory.summary
    )
