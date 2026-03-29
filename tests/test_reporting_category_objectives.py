from datetime import datetime, timedelta

from sqlmodel import Session, SQLModel, create_engine

from backend.app.models import Session as WorkSession, SessionStatus, Task
from backend.app.reporting import ReportingService

TEST_USER_ID = 1


def test_category_objective_progress_is_scoped_to_each_day() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    week_start = datetime(2026, 3, 23, 0, 0, 0)
    week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)

    with Session(engine) as db:
        task = Task(
            title="Execution Block",
            objective="Ship the reporting fix",
            long_term_goal="Reporting",
            priority=4,
            user_id=TEST_USER_ID,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        sessions = [
            WorkSession(
                task_id=task.id,
                planned_start=week_start + timedelta(hours=9),
                planned_end=week_start + timedelta(hours=10),
                actual_start=week_start + timedelta(hours=9),
                actual_end=week_start + timedelta(hours=10),
                status=SessionStatus.completed,
                objective="Patch the report",
                objective_completed=True,
                completion_percent=100,
                user_id=TEST_USER_ID,
            ),
            WorkSession(
                task_id=task.id,
                planned_start=week_start + timedelta(days=1, hours=9),
                planned_end=week_start + timedelta(days=1, hours=10),
                actual_start=week_start + timedelta(days=1, hours=9),
                actual_end=week_start + timedelta(days=1, hours=10),
                status=SessionStatus.completed,
                objective="Review the result",
                objective_completed=False,
                completion_percent=40,
                user_id=TEST_USER_ID,
            ),
            WorkSession(
                task_id=task.id,
                planned_start=week_start + timedelta(days=2, hours=9),
                planned_end=week_start + timedelta(days=2, hours=10),
                actual_start=week_start + timedelta(days=2, hours=9),
                actual_end=week_start + timedelta(days=2, hours=10),
                status=SessionStatus.completed,
                objective="Validate the edge case",
                objective_completed=True,
                completion_percent=100,
                user_id=TEST_USER_ID,
            ),
            WorkSession(
                task_id=task.id,
                planned_start=week_start + timedelta(days=2, hours=11),
                planned_end=week_start + timedelta(days=2, hours=12),
                actual_start=week_start + timedelta(days=2, hours=11),
                actual_end=week_start + timedelta(days=2, hours=12),
                status=SessionStatus.completed,
                objective="Check another case",
                objective_completed=False,
                completion_percent=25,
                user_id=TEST_USER_ID,
            ),
        ]
        db.add_all(sessions)
        db.commit()

        report = ReportingService().weekly_report(db, week_start, week_end, TEST_USER_ID)

    assert len(report.category_objectives) == 1

    summary = report.category_objectives[0]
    assert summary.category == "Reporting"
    assert summary.completion_percent == 50.0
    assert [
        (point.label, point.objective_count, point.completed_objectives, point.completion_percent)
        for point in summary.progress_by_day
    ] == [
        ("Mon", 1, 1, 100.0),
        ("Tue", 1, 0, 0.0),
        ("Wed", 2, 1, 50.0),
        ("Thu", 0, 0, 0.0),
        ("Fri", 0, 0, 0.0),
        ("Sat", 0, 0, 0.0),
        ("Sun", 0, 0, 0.0),
    ]
