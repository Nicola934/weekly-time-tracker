from __future__ import annotations

from datetime import datetime

from sqlmodel import Session, select

from .behavior import BehaviorService
from .metrics import MetricsService
from .models import Session as WorkSession, SessionStatus, Task
from .schemas import AdvisoryResponse


class AdvisorService:
    def __init__(self) -> None:
        self.metrics = MetricsService()
        self.behavior = BehaviorService()

    def generate(self, db: Session, period_start: datetime, period_end: datetime) -> AdvisoryResponse:
        metrics = self.metrics.compute_metrics(db, period_start, period_end)

        tasks = list(db.exec(select(Task)).all())

        sessions = list(
            db.exec(
                select(WorkSession).where(
                    WorkSession.planned_start >= period_start,
                    WorkSession.planned_end <= period_end,
                )
            ).all()
        )

        focus_areas = []

        if metrics.signal_percent < 75:
            focus_areas.append("Reduce schedule overload and protect planned focus blocks.")

        if metrics.average_lateness_minutes > 5:
            focus_areas.append("Add stronger pre-session cues 10 minutes before start time.")

        if metrics.performance_percent < 70:
            focus_areas.append("Break large tasks into smaller outputs with explicit completion targets.")

        task_summary = {task.id: task for task in tasks}

        top_completed = max(
            (session for session in sessions if session.status == SessionStatus.completed),
            key=lambda item: item.completion_percent,
            default=None,
        )

        summary = []

        if top_completed and top_completed.task_id in task_summary:
            summary.append(f"Your strongest execution is {task_summary[top_completed.task_id].title}.")

        summary.extend(self.behavior.identify_behavior_risks(db, period_start, period_end))

        schedule_improvements = [
            "Shift high-friction sessions away from your most-missed time window.",
            "Reserve one buffer block each day for spillover or recovery.",
        ]

        habit_alerts = [
            pattern.category
            for pattern in self.behavior.weekly_patterns(db, period_start, period_end)[:3]
        ]

        if tasks:
            aligned = sorted(tasks, key=lambda item: (-item.priority, item.estimated_hours))[:3]
            focus_areas.extend(
                [f"Keep {task.title} anchored to goal: {task.long_term_goal}." for task in aligned]
            )

        return AdvisoryResponse(
            summary=summary,
            focus_areas=focus_areas,
            schedule_improvements=schedule_improvements,
            habit_alerts=habit_alerts,
        )