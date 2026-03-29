from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .models import (
    MissedReasonCategory,
    NotificationTone,
    SessionFailureReason,
    SessionQualityLabel,
    SessionStatus,
)


class TaskCreate(BaseModel):
    title: str
    objective: str
    category: str = ""
    long_term_goal: str = ""
    priority: int = 3
    estimated_hours: float = 0


class ScheduleCreate(BaseModel):
    task_id: int
    start_time: datetime
    end_time: datetime
    reminder_offset_minutes: Optional[int] = Field(default=None, ge=0)
    timezone: str = "UTC"
    notes: str = ""
    goal_context: Optional[str] = None


class SessionStartRequest(BaseModel):
    task_id: int
    session_id: Optional[int] = None
    schedule_block_id: Optional[int] = None
    actual_start: Optional[datetime] = None
    timezone: str = "UTC"


class SessionEndRequest(BaseModel):
    session_id: int
    actual_end: Optional[datetime] = None
    objective_completed: bool = False
    completion_percent: float = Field(default=0, ge=0, le=100)
    output_notes: str = ""
    reflection_notes: str = ""
    failure_reason: Optional[SessionFailureReason] = None
    failure_reason_detail: Optional[str] = None
    distraction_category: Optional[str] = None


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


class GoalContextSettingsResponse(BaseModel):
    category_goals: dict[str, list[str]] = Field(default_factory=dict)
    categories: list[str] = Field(default_factory=list)
    goals: list[str] = Field(default_factory=list)
    updated_at: datetime | None = None


class GoalContextSettingsUpdate(BaseModel):
    category_goals: dict[str, list[str]] = Field(default_factory=dict)


class MetricsResponse(BaseModel):
    signal_percent: float
    performance_percent: float
    punctuality_rate: float
    average_lateness_minutes: float
    average_start_delta_minutes: float
    discipline_score: float


class HabitPattern(BaseModel):
    category: str
    count: int
    minutes_lost: int


class NarrativeWeeklyFeedback(BaseModel):
    wins: str
    gaps: str
    patterns: str
    insight: str
    advice: str
    narrative: str


class AdvisoryResponse(BaseModel):
    summary: list[str]
    focus_areas: list[str]
    schedule_improvements: list[str]
    habit_alerts: list[str]
    weekly_feedback: NarrativeWeeklyFeedback


class ObjectiveProgressPoint(BaseModel):
    label: str
    completion_percent: float
    objective_count: int = 0
    completed_objectives: int = 0


class CategoryObjectiveSummary(BaseModel):
    category: str
    objective_count: int
    completed_objectives: int
    target_total: int
    completed_total: int
    completion_percent: float
    progress_by_day: list[ObjectiveProgressPoint]


class TrendPoint(BaseModel):
    label: str
    completed_sessions: int
    time_spent_minutes: float
    performance_percent: float


class ProgressTrendResponse(BaseModel):
    label: str
    session_count: int
    current_completed_sessions: int
    previous_completed_sessions: int
    current_completion_rate: float
    previous_completion_rate: float
    completion_change_percent: Optional[float]
    current_time_spent_minutes: float
    previous_time_spent_minutes: float
    time_change_percent: Optional[float]
    current_performance_percent: float
    previous_performance_percent: float
    performance_change_percent: Optional[float]
    daily: list[TrendPoint]


class ReflectionSummaryResponse(BaseModel):
    top_failure_reason: Optional[str] = None
    top_failure_reason_count: int = 0
    top_distraction_category: Optional[str] = None
    top_distraction_count: int = 0


class StreakMetric(BaseModel):
    current: int = 0
    longest: int = 0


class StreakSummaryResponse(BaseModel):
    completed_days: StreakMetric = Field(default_factory=StreakMetric)
    completed_sessions: StreakMetric = Field(default_factory=StreakMetric)


class WeeklyTimelineItem(BaseModel):
    session_id: int
    title: str
    category: str
    planned_start: datetime
    planned_end: datetime
    actual_start: Optional[datetime] = None
    actual_end: Optional[datetime] = None
    objective: str = ""
    actual_outcome: str = ""
    status: SessionStatus
    objective_completed: bool = False
    failure_reason: Optional[str] = None
    distraction_category: Optional[str] = None
    start_delta_minutes: Optional[float] = None
    quality_score: float = 0
    quality_label: SessionQualityLabel = SessionQualityLabel.failed


class WeeklyReportResponse(BaseModel):
    period_start: datetime
    period_end: datetime
    metrics: MetricsResponse
    habits: list[HabitPattern]
    task_hours: dict[str, float]
    category_objectives: list[CategoryObjectiveSummary]
    category_trends: list[ProgressTrendResponse]
    repeated_session_trends: list[ProgressTrendResponse]
    reflection_summary: ReflectionSummaryResponse
    streaks: StreakSummaryResponse
    timeline: list[WeeklyTimelineItem]
    recommendations: list[str]
    advisor: AdvisoryResponse


class SessionView(BaseModel):
    id: int
    task_id: int
    planned_start: datetime
    planned_end: datetime
    reminder_offset_minutes: Optional[int] = None
    actual_start: Optional[datetime]
    actual_end: Optional[datetime]
    status: SessionStatus
    objective: Optional[str] = None
    goal_context: Optional[str] = None
    objective_completed: bool = False
    objective_locked: bool = False
    completion_percent: float
    reflection_notes: str = ""
    failure_reason: Optional[SessionFailureReason] = None
    failure_reason_detail: Optional[str] = None
    distraction_category: Optional[str] = None
    start_delta_minutes: Optional[float] = None
    quality_score: float = 0
    quality_label: SessionQualityLabel = SessionQualityLabel.failed
