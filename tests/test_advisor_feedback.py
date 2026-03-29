from datetime import datetime

from sqlmodel import Session, SQLModel, create_engine

from backend.app.advisor import AdvisorService
from backend.app.models import (
    MissedHabit,
    MissedReasonCategory,
    Session as WorkSession,
    SessionStatus,
    Task,
)


def _memory_db() -> Session:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_advisor_feedback_uses_direct_breakdown_language() -> None:
    period_start = datetime(2026, 3, 23, 0, 0, 0)
    period_end = datetime(2026, 3, 29, 23, 59, 59)

    with _memory_db() as db:
        task = Task(
            title="System",
            objective="Improve system architecture",
            long_term_goal="System Development",
            priority=5,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        missed_sessions = [
            WorkSession(
                task_id=task.id,
                planned_start=datetime(2026, 3, 24, 14, 0, 0),
                planned_end=datetime(2026, 3, 24, 15, 0, 0),
                status=SessionStatus.missed,
            ),
            WorkSession(
                task_id=task.id,
                planned_start=datetime(2026, 3, 25, 15, 0, 0),
                planned_end=datetime(2026, 3, 25, 16, 0, 0),
                status=SessionStatus.missed,
            ),
        ]
        partial_session = WorkSession(
            task_id=task.id,
            planned_start=datetime(2026, 3, 26, 14, 0, 0),
            planned_end=datetime(2026, 3, 26, 15, 0, 0),
            actual_start=datetime(2026, 3, 26, 14, 20, 0),
            actual_end=datetime(2026, 3, 26, 15, 0, 0),
            status=SessionStatus.completed,
            completion_percent=50,
        )
        db.add_all([*missed_sessions, partial_session])
        db.commit()

        for item in missed_sessions:
            db.add(
                MissedHabit(
                    session_id=item.id,
                    task_id=task.id,
                    reason_category=MissedReasonCategory.social_media,
                    captured_at=item.planned_end,
                    time_lost_minutes=45,
                )
            )
        db.commit()

        feedback = AdvisorService().generate(db, period_start, period_end).weekly_feedback

        assert "A recurring pattern shows" not in feedback.patterns
        assert "It suggests that" not in feedback.narrative
        assert "Consider" not in feedback.advice
        assert "You consistently lose control of your afternoon sessions." in feedback.patterns
        assert (
            'Your system says you value System Development, but your behavior kept giving "Improve system architecture" away to social media.'
            in feedback.patterns
        )
        assert (
            'You planned to advance "Improve system architecture" work under System Development, but those sessions were replaced by low-value activity such as social media, which directly slowed progress on "Improve system architecture".'
            == feedback.insight
        )
        assert (
            'Move "Improve system architecture" work under System Development to the morning and lock it as non-negotiable.'
            in feedback.advice
        )
        assert "Eliminate social media completely during high-priority sessions." in feedback.advice


def test_advisor_feedback_reinforces_strong_execution_without_generic_language() -> None:
    period_start = datetime(2026, 3, 23, 0, 0, 0)
    period_end = datetime(2026, 3, 29, 23, 59, 59)

    with _memory_db() as db:
        task = Task(
            title="Sales",
            objective="Sell to property management companies",
            long_term_goal="Business Development",
            priority=4,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        db.add_all(
            [
                WorkSession(
                    task_id=task.id,
                    planned_start=datetime(2026, 3, 24, 9, 0, 0),
                    planned_end=datetime(2026, 3, 24, 10, 0, 0),
                    actual_start=datetime(2026, 3, 24, 9, 0, 0),
                    actual_end=datetime(2026, 3, 24, 10, 0, 0),
                    status=SessionStatus.completed,
                    completion_percent=100,
                    objective_completed=True,
                ),
                WorkSession(
                    task_id=task.id,
                    planned_start=datetime(2026, 3, 25, 9, 0, 0),
                    planned_end=datetime(2026, 3, 25, 10, 0, 0),
                    actual_start=datetime(2026, 3, 25, 9, 2, 0),
                    actual_end=datetime(2026, 3, 25, 10, 0, 0),
                    status=SessionStatus.completed,
                    completion_percent=100,
                    objective_completed=True,
                ),
            ]
        )
        db.commit()

        feedback = AdvisorService().generate(db, period_start, period_end).weekly_feedback

        assert feedback.wins.startswith("You executed with control this week.")
        assert feedback.patterns == (
            "You protected the week well. The blocks you kept turned into real output."
        )
        assert "A recurring pattern shows" not in feedback.patterns
        assert "Consider" not in feedback.advice
        assert (
            'You planned to advance "Sell to property management companies" work under Business Development, protected the block, and converted that time into real progress.'
            == feedback.insight
        )
