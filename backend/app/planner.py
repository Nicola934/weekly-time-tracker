import logging
from datetime import datetime

from sqlmodel import Session, select

from .models import ScheduleBlock, Session as WorkSession, SessionStatus, Task
from .ownership import require_owned_record
from .schemas import ScheduleCreate, TaskCreate

logger = logging.getLogger(__name__)


def _comparable_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=None) if value.tzinfo else value


class PlannerService:
    def create_task(self, db: Session, payload: TaskCreate, user_id: int) -> Task:
        task = Task.model_validate(payload)
        task.user_id = user_id
        db.add(task)
        db.commit()
        db.refresh(task)
        return task

    def list_tasks(self, db: Session, user_id: int) -> list[Task]:
        return list(
            db.exec(
                select(Task)
                .where(Task.user_id == user_id)
                .order_by(Task.priority, Task.created_at)
            ).all()
        )

    def create_schedule_block(
        self,
        db: Session,
        payload: ScheduleCreate,
        user_id: int,
    ) -> tuple[ScheduleBlock, WorkSession]:
        if payload.end_time <= payload.start_time:
            raise ValueError("Schedule end time must be after start time")
        if _comparable_datetime(payload.start_time) <= _comparable_datetime(
            datetime.now().replace(microsecond=0)
        ):
            raise ValueError("Only future sessions can be scheduled")
        require_owned_record(
            db,
            Task,
            payload.task_id,
            user_id,
            f"Task not found for id {payload.task_id}",
        )

        block = ScheduleBlock.model_validate(payload)
        block.user_id = user_id
        db.add(block)
        db.commit()
        db.refresh(block)

        planned_session = WorkSession(
            user_id=user_id,
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
        db.refresh(planned_session)
        return block, planned_session

    def update_planned_session(
        self,
        db: Session,
        session_id: int,
        payload: ScheduleCreate,
        user_id: int,
    ) -> WorkSession:
        logger.info("Planner session lookup for update: session_id=%s", session_id)
        if payload.end_time <= payload.start_time:
            raise ValueError("Schedule end time must be after start time")
        now = _comparable_datetime(datetime.now().replace(microsecond=0))
        if _comparable_datetime(payload.start_time) <= now:
            raise ValueError("Rescheduled sessions must start in the future")
        require_owned_record(
            db,
            Task,
            payload.task_id,
            user_id,
            f"Task not found for id {payload.task_id}",
        )

        session = require_owned_record(
            db,
            WorkSession,
            session_id,
            user_id,
            f"Session not found for id {session_id}",
        )
        if session.status != SessionStatus.planned:
            logger.warning(
                "Planner session update failed: session_id=%s status=%s",
                session_id,
                session.status,
            )
            raise ValueError("Only planned sessions can be edited")
        if _comparable_datetime(session.planned_end) <= now:
            logger.warning(
                "Planner session update failed: session_id=%s planned_end=%s",
                session_id,
                session.planned_end,
            )
            raise ValueError("Only pending sessions can be rescheduled")

        session.task_id = payload.task_id
        session.planned_start = payload.start_time
        session.planned_end = payload.end_time
        session.reminder_offset_minutes = payload.reminder_offset_minutes
        session.objective = payload.notes or None
        session.goal_context = payload.goal_context
        session.output_notes = payload.notes
        session.timezone = payload.timezone

        if session.schedule_block_id:
            block = require_owned_record(
                db,
                ScheduleBlock,
                session.schedule_block_id,
                user_id,
                "Schedule block not found",
            )

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

    def list_schedule(self, db: Session, user_id: int) -> list[ScheduleBlock]:
        return list(
            db.exec(
                select(ScheduleBlock)
                .where(ScheduleBlock.user_id == user_id)
                .order_by(ScheduleBlock.start_time)
            ).all()
        )
