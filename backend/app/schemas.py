from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .models import MissedReasonCategory, NotificationTone, SessionStatus


class TaskCreate(BaseModel):
    title: str
    objective: str
    long_term_goal: str
    priority: int = 3
    estimated_hours: float = 0


class ScheduleCreate(BaseModel):
    task_id: int
    start_time: datetime
    end_time: datetime
    timezone: str = "UTC"
    notes: str = ""


class SessionStartRequest(BaseModel):
    task_id: int
    session_id: Optional[int] = None
    schedule_block_id: Optional[int] = None
    actual_start: Optional[datetime] = None
    timezone: str = "UTC"


class SessionEndRequest(BaseModel):
    session_id: int
    actual_end: Optional[datetime] = None
    completion_percent: float = Field(default=0, ge=0, le=100)
    output_notes: str = ""


class SessionMissedRequest(BaseModel):
    session_id: int
    reason_category: MissedReasonCategory
    custom_reason: Optional[str] = None
    time_lost_minutes: int = Field(default=0, ge=0)


class NotificationConfigUpdate(BaseModel):
    tone: NotificationTone = NotificationTone.strict
    pre_session_minutes: int = 10
    enabled: bool = True
    start_script: str
    late_script: str
    pre_script: str


class MetricsResponse(BaseModel):
    signal_percent: float
    performance_percent: float
    punctuality_rate: float
    average_lateness_minutes: float
    discipline_score: float


class HabitPattern(BaseModel):
    category: str
    count: int
    minutes_lost: int


class AdvisoryResponse(BaseModel):
    summary: list[str]
    focus_areas: list[str]
    schedule_improvements: list[str]
    habit_alerts: list[str]


class WeeklyReportResponse(BaseModel):
    period_start: datetime
    period_end: datetime
    metrics: MetricsResponse
    habits: list[HabitPattern]
    task_hours: dict[str, float]
    recommendations: list[str]


class SessionView(BaseModel):
    id: int
    task_id: int
    planned_start: datetime
    planned_end: datetime
    actual_start: Optional[datetime]
    actual_end: Optional[datetime]
    status: SessionStatus
    completion_percent: float
