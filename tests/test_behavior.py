from datetime import datetime, timedelta

from sqlmodel import Session, SQLModel, create_engine

from backend.app.behavior import BehaviorService
from backend.app.models import MissedReasonCategory, Session as WorkSession, SessionStatus, Task
from backend.app.schemas import SessionMissedRequest

TEST_USER_ID = 1


def test_record_missed_session_and_aggregate_patterns() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    service = BehaviorService()
    now = datetime(2026, 3, 21, 12, 0, 0)

    with Session(engine) as db:
        task = Task(
            title="Focus Block",
            objective="Finish task",
            long_term_goal="Goal",
            priority=5,
            user_id=TEST_USER_ID,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        session = WorkSession(
            task_id=task.id,
            planned_start=now - timedelta(hours=1),
            planned_end=now,
            status=SessionStatus.planned,
            user_id=TEST_USER_ID,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        service.record_missed_session(
            db,
            SessionMissedRequest(
                session_id=session.id,
                reason_category=MissedReasonCategory.youtube,
                time_lost_minutes=30,
            ),
            TEST_USER_ID,
        )

        patterns = service.weekly_patterns(
            db,
            now - timedelta(days=7),
            now + timedelta(days=1),
            TEST_USER_ID,
        )
        assert patterns[0].category == "YouTube"
        assert patterns[0].minutes_lost == 30

        risks = service.identify_behavior_risks(
            db,
            now - timedelta(days=7),
            now + timedelta(days=1),
            TEST_USER_ID,
        )
        assert any("You frequently miss sessions due to YouTube." == item for item in risks)
