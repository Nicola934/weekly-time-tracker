from datetime import datetime, timedelta

from sqlmodel import Session, SQLModel, create_engine

from backend.app.models import Session as WorkSession, SessionFailureReason, SessionStatus, Task
from backend.app.reporting import ReportingService

TEST_USER_ID = 1


def _memory_db() -> Session:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_weekly_report_surfaces_reflection_summary_streaks_and_timeline() -> None:
    week_start = datetime(2026, 3, 23, 0, 0, 0)
    period_end = week_start + timedelta(days=2, hours=23, minutes=59, seconds=59)

    with _memory_db() as db:
        task = Task(
            title="Backend Execution",
            objective="Ship the tracker changes",
            long_term_goal="Backend",
            priority=4,
            user_id=TEST_USER_ID,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        db.add_all(
            [
                WorkSession(
                    task_id=task.id,
                    planned_start=week_start + timedelta(hours=14),
                    planned_end=week_start + timedelta(hours=15),
                    actual_start=week_start + timedelta(hours=14),
                    actual_end=week_start + timedelta(hours=15),
                    status=SessionStatus.completed,
                    objective="Ship the tracker changes",
                    objective_completed=False,
                    objective_locked=True,
                    completion_percent=0,
                    reflection_notes="Got trapped in social media before the final pass.",
                    failure_reason=SessionFailureReason.distraction,
                    distraction_category="Social media",
                    quality_score=60,
                    user_id=TEST_USER_ID,
                ),
                WorkSession(
                    task_id=task.id,
                    planned_start=week_start + timedelta(days=1, hours=9),
                    planned_end=week_start + timedelta(days=1, hours=10),
                    actual_start=week_start + timedelta(days=1, hours=9),
                    actual_end=week_start + timedelta(days=1, hours=10),
                    status=SessionStatus.completed,
                    objective="Finish the backend patch",
                    objective_completed=True,
                    objective_locked=True,
                    completion_percent=100,
                    quality_score=100,
                    quality_label="strong",
                    user_id=TEST_USER_ID,
                ),
                WorkSession(
                    task_id=task.id,
                    planned_start=week_start + timedelta(days=2, hours=9),
                    planned_end=week_start + timedelta(days=2, hours=10),
                    actual_start=week_start + timedelta(days=2, hours=9),
                    actual_end=week_start + timedelta(days=2, hours=10),
                    status=SessionStatus.completed,
                    objective="Verify the final backend path",
                    objective_completed=True,
                    objective_locked=True,
                    completion_percent=100,
                    quality_score=100,
                    quality_label="strong",
                    user_id=TEST_USER_ID,
                ),
            ]
        )
        db.commit()

        report = ReportingService().weekly_report(
            db,
            week_start,
            period_end,
            TEST_USER_ID,
        )

    assert report.reflection_summary.top_failure_reason == "Distraction"
    assert report.reflection_summary.top_failure_reason_count == 1
    assert report.reflection_summary.top_distraction_category == "Social media"
    assert report.streaks.completed_days.current == 2
    assert report.streaks.completed_days.longest == 2
    assert report.streaks.completed_sessions.current == 2
    assert report.timeline[0].actual_outcome == "Got trapped in social media before the final pass."
    assert report.timeline[0].quality_label.value == "partial"
