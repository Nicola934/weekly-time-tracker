from datetime import datetime, timedelta

from sqlmodel import Session, SQLModel, create_engine

from backend.app.metrics import MetricsService
from backend.app.models import Session as WorkSession, SessionStatus, Task, UserAccount


def test_metrics_service_computes_signal_performance_and_lateness() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    now = datetime(2026, 3, 21, 12, 0, 0)

    with Session(engine) as db:
        user = UserAccount(
            name="Operator",
            email="reporting-metrics@example.com",
            password_hash="hash",
            password_salt="salt",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        task = Task(
            title="Execution",
            objective="Ship feature",
            long_term_goal="Grow platform",
            priority=4,
            user_id=user.id,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        session = WorkSession(
            task_id=task.id,
            planned_start=now - timedelta(hours=2),
            planned_end=now - timedelta(hours=1),
            actual_start=now - timedelta(hours=2) + timedelta(minutes=10),
            actual_end=now - timedelta(hours=1),
            status=SessionStatus.completed,
            objective_completed=True,
            completion_percent=80,
            quality_score=80,
            user_id=user.id,
        )
        db.add(session)
        db.commit()

        metrics = MetricsService().compute_metrics(
            db,
            now - timedelta(days=1),
            now,
            user.id,
        )
        assert metrics.signal_percent == 83.33
        assert metrics.performance_percent == 80.0
        assert metrics.average_lateness_minutes == 10.0
