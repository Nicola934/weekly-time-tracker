from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any

from .models import ScheduleBlock, Session, Task


def _serialize_value(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    return value


def _serialize_record(record: Any, fields: tuple[str, ...]) -> dict[str, Any]:
    return {field: _serialize_value(getattr(record, field, None)) for field in fields}


def serialize_task(task: Task) -> dict[str, Any]:
    return _serialize_record(
        task,
        (
            "id",
            "user_id",
            "title",
            "objective",
            "long_term_goal",
            "priority",
            "estimated_hours",
            "category",
            "created_at",
        ),
    )


def serialize_schedule_block(block: ScheduleBlock) -> dict[str, Any]:
    return _serialize_record(
        block,
        (
            "id",
            "user_id",
            "task_id",
            "start_time",
            "end_time",
            "timezone",
            "notes",
        ),
    )


def serialize_session(session: Session) -> dict[str, Any]:
    return _serialize_record(
        session,
        (
            "id",
            "user_id",
            "task_id",
            "schedule_block_id",
            "planned_start",
            "planned_end",
            "actual_start",
            "actual_end",
            "reminder_offset_minutes",
            "completion_percent",
            "status",
            "objective",
            "goal_context",
            "objective_completed",
            "objective_locked",
            "output_notes",
            "reflection_notes",
            "failure_reason",
            "failure_reason_detail",
            "distraction_category",
            "start_delta_minutes",
            "quality_score",
            "quality_label",
            "timezone",
            "created_at",
        ),
    )
