import logging
from datetime import datetime

from sqlmodel import Session, select

from .models import ScheduleBlock, Session as WorkSession, SessionStatus, Task
from .schemas import ScheduleCreate, TaskCreate

logger = logging.getLogger(__name__)


def _comparable_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=None) if value.tzinfo else value


class PlannerService:
    def create_task(self, db: Session, payload: TaskCreate) -> Task:
        task = Task.model_validate(payload)
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    def list_tasks(self, db: Session) -> list[Task]:
        return list(db.exec(select(Task).order_by(Task.priority, Task.created_at)).all())

    def create_schedule_block(self, db: Session, payload: ScheduleCreate) -> ScheduleBlock:
        if payload.end_time <= payload.start_time:
            raise ValueError("Schedule end time must be after start time")
        if _comparable_datetime(payload.start_time) <= _comparable_datetime(
            datetime.now().replace(microsecond=0)
        ):
            raise ValueError("Only future sessions can be scheduled")

        block = ScheduleBlock.model_validate(payload)
        db.add(block)
        db.commit()
        db.refresh(block)

        planned_session = WorkSession(
            task_id=block.task_id,
            schedule_block_id=block.id,
            planned_start=block.start_time,
            planned_end=block.end_time,
            reminder_offset_minutes=payload.reminder_offset_minutes,
            status=SessionStatus.planned,
            objective=payload.notes or None,
            goal_context=payload.goal_context,
            output_notes=payload.notes,
            timezone=block.timezone,
        )
        db.add(planned_session)
        db.commit()
        return block

    def update_planned_session(
        self,
        db: Session,
        session_id: int,
        payload: ScheduleCreate,
    ) -> WorkSession:
        logger.info("Planner session lookup for update: session_id=%s", session_id)
        if payload.end_time <= payload.start_time:
            raise ValueError("Schedule end time must be after start time")

        session = db.get(WorkSession, session_id)
        if not session:
            logger.warning(
                "Planner session update failed: session_id=%s not found",
                session_id,
            )
            raise ValueError(f"Session not found for id {session_id}")
        if session.status != SessionStatus.planned:
            logger.warning(
                "Planner session update failed: session_id=%s status=%s",
                session_id,
                session.status,
            )
            raise ValueError("Only planned sessions can be edited")
        if _comparable_datetime(session.planned_start) <= _comparable_datetime(
            datetime.now().replace(microsecond=0)
        ):
            logger.warning(
                "Planner session update failed: session_id=%s planned_start=%s",
                session_id,
                session.planned_start,
            )
            raise ValueError("Only future sessions can be edited")

        session.task_id = payload.task_id
        session.planned_start = payload.start_time
        session.planned_end = payload.end_time
        session.reminder_offset_minutes = payload.reminder_offset_minutes
        session.objective = payload.notes or None
        session.goal_context = payload.goal_context
        session.output_notes = payload.notes
        session.timezone = payload.timezone

        if session.schedule_block_id:
            block = db.get(ScheduleBlock, session.schedule_block_id)
            if not block:
                logger.warning(
                    "Planner session update failed: session_id=%s missing schedule_block_id=%s",
                    session_id,
                    session.schedule_block_id,
                )
                raise ValueError("Schedule block not found")

            block.task_id = payload.task_id
            block.start_time = payload.start_time
            block.end_time = payload.end_time
            block.timezone = payload.timezone
            block.notes = payload.notes
            db.add(block)

        db.add(session)
        db.commit()
        db.refresh(session)
        logger.info(
            "Planner session update persisted: session_id=%s task_id=%s schedule_block_id=%s",
            session.id,
            session.task_id,
            session.schedule_block_id,
        )
        return session

    def list_schedule(self, db: Session) -> list[ScheduleBlock]:
        return list(db.exec(select(ScheduleBlock).order_by(ScheduleBlock.start_time)).all())
