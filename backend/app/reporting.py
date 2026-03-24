from __future__ import annotations

from datetime import datetime
from io import BytesIO
import json

from openpyxl import Workbook
from sqlmodel import Session, select

from .advisor import AdvisorService
from .behavior import BehaviorService
from .metrics import MetricsService, minutes_between
from .models import Session as WorkSession, Task
from .schemas import WeeklyReportResponse


class ReportingService:
    def __init__(self) -> None:
        self.metrics = MetricsService()
        self.behavior = BehaviorService()
        self.advisor = AdvisorService()

    def weekly_report(self, db: Session, period_start: datetime, period_end: datetime) -> WeeklyReportResponse:
        sessions = list(
            db.exec(
                select(WorkSession).where(
                    WorkSession.planned_start >= period_start,
                    WorkSession.planned_end <= period_end,
                )
            ).all()
        )
        tasks = {task.id: task.title for task in db.exec(select(Task)).all()}
        task_hours: dict[str, float] = {}
        for item in sessions:
            label = tasks.get(item.task_id, f"Task {item.task_id}")
            task_hours[label] = round(task_hours.get(label, 0) + (minutes_between(item.actual_start, item.actual_end) / 60), 2)
        advisory = self.advisor.generate(db, period_start, period_end)
        return WeeklyReportResponse(
            period_start=period_start,
            period_end=period_end,
            metrics=self.metrics.compute_metrics(db, period_start, period_end),
            habits=self.behavior.weekly_patterns(db, period_start, period_end),
            task_hours=task_hours,
            recommendations=advisory.focus_areas + advisory.schedule_improvements,
        )

    def export_json(self, report: WeeklyReportResponse) -> str:
        return report.model_dump_json(indent=2)

    def export_text(self, report: WeeklyReportResponse) -> str:
        lines = [
            f"Weekly report: {report.period_start.date()} to {report.period_end.date()}",
            f"Signal: {report.metrics.signal_percent}%",
            f"Performance: {report.metrics.performance_percent}%",
            f"Punctuality: {report.metrics.punctuality_rate}%",
            "Habit breakdown:",
        ]
        lines.extend([f"- {item.category}: {item.count} misses / {item.minutes_lost} minutes lost" for item in report.habits])
        return "\n".join(lines)

    def export_excel(self, report: WeeklyReportResponse) -> bytes:
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Weekly Report"
        sheet.append(["Metric", "Value"])
        sheet.append(["Signal %", report.metrics.signal_percent])
        sheet.append(["Performance %", report.metrics.performance_percent])
        sheet.append(["Punctuality %", report.metrics.punctuality_rate])
        sheet.append([])
        sheet.append(["Habit", "Misses", "Minutes Lost"])
        for item in report.habits:
            sheet.append([item.category, item.count, item.minutes_lost])
        output = BytesIO()
        workbook.save(output)
        return output.getvalue()
