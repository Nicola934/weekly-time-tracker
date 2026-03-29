from __future__ import annotations

from datetime import UTC, datetime
from enum import Enum
from typing import Optional

from sqlmodel import Field, SQLModel


class SessionStatus(str, Enum):
    planned = "planned"
    active = "active"
    completed = "completed"
    missed = "missed"


class NotificationTone(str, Enum):
    strict = "strict"
    motivational = "motivational"


class MissedReasonCategory(str, Enum):
    social_media = "Social media"
    youtube = "YouTube"
    resting = "Resting"
    other_work = "Other work"
    distraction = "Distraction"
    unknown = "Unknown"
    custom = "Custom"


class SessionFailureReason(str, Enum):
    distraction = "Distraction"
    underestimated_effort = "Underestimated effort"
    low_energy = "Low energy"
    external_interruption = "External interruption"
    other = "Other"


class SessionQualityLabel(str, Enum):
    strong = "strong"
    partial = "partial"
    failed = "failed"


class TaskBase(SQLModel):
    title: str
    objective: str
    category: str = ""
    long_term_goal: str = ""
    priority: int = 3
    estimated_hours: float = 0


class Task(TaskBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class ScheduleBlockBase(SQLModel):
    task_id: int = Field(foreign_key="task.id")
    start_time: datetime
    end_time: datetime
    timezone: str = "UTC"
    notes: str = ""


class ScheduleBlock(ScheduleBlockBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)


class SessionBase(SQLModel):
    task_id: int = Field(foreign_key="task.id")
    schedule_block_id: Optional[int] = Field(default=None, foreign_key="scheduleblock.id")
    planned_start: datetime
    planned_end: datetime
    reminder_offset_minutes: Optional[int] = None
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    status: SessionStatus = SessionStatus.planned
    objective: Optional[str] = None
    goal_context: Optional[str] = None
    objective_completed: bool = False
    objective_locked: bool = False
    completion_percent: float = 0
    output_notes: str = ""
    reflection_notes: str = ""
    failure_reason: Optional[SessionFailureReason] = None
    failure_reason_detail: Optional[str] = None
    distraction_category: Optional[str] = None
    start_delta_minutes: Optional[float] = None
    quality_score: float = 0
    quality_label: SessionQualityLabel = SessionQualityLabel.failed
    timezone: str = "UTC"


class Session(SessionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class MissedHabitBase(SQLModel):
    session_id: int = Field(foreign_key="session.id")
    task_id: int = Field(foreign_key="task.id")
    reason_category: MissedReasonCategory
    custom_reason: Optional[str] = None
    captured_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    time_lost_minutes: int = 0


class MissedHabit(MissedHabitBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)


class NotificationConfig(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    tone: NotificationTone = NotificationTone.strict
    pre_session_minutes: int = 10
    enabled: bool = True
    start_script: str = "session starts now."
    late_script: str = "you are now {minutes} minutes late. Start now."
    pre_script: str = "session starts in {minutes} minutes."


class GoalContextConfig(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    category_goals_json: str = "{}"


class SyncEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    entity_type: str
    entity_id: int
    action: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    synced: bool = False


class WeeklyProgressMemory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    week_start: datetime
    week_end: datetime
    objective_completion_rate: float = 0
    completed_objectives: int = 0
    objective_total: int = 0
    missed_sessions: int = 0
    average_quality_score: float = 0
    top_failure_reason: Optional[str] = None
    top_distraction_category: Optional[str] = None
    weakest_time_bucket: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
