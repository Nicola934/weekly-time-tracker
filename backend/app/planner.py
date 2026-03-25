from sqlmodel import Session, select

from .models import ScheduleBlock, Session as WorkSession, SessionStatus, Task
from .schemas import ScheduleCreate, TaskCreate


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

        block = ScheduleBlock.model_validate(payload)
        db.add(block)
        db.commit()
        db.refresh(block)

        planned_session = WorkSession(
            task_id=block.task_id,
            schedule_block_id=block.id,
            planned_start=block.start_time,
            planned_end=block.end_time,
            status=SessionStatus.planned,
            timezone=block.timezone,
        )
        db.add(planned_session)
        db.commit()
        return block

    def list_schedule(self, db: Session) -> list[ScheduleBlock]:
        return list(db.exec(select(ScheduleBlock).order_by(ScheduleBlock.start_time)).all())
