from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from io import BytesIO

from openpyxl import Workbook
from sqlmodel import Session, select

from .advisor import AdvisorService
from .behavior import BehaviorService
from .metrics import MetricsService, calculate_session_quality, minutes_between
from .models import Session as WorkSession, SessionQualityLabel, SessionStatus, Task, WeeklyProgressMemory
from .notifier import resolve_task_category
from .schemas import (
    CategoryObjectiveSummary,
    ObjectiveProgressPoint,
    ProgressTrendResponse,
    ReflectionSummaryResponse,
    StreakMetric,
    StreakSummaryResponse,
    TrendPoint,
    WeeklyTimelineItem,
    WeeklyReportResponse,
)
from .tracker import TrackerService


def _start_of_day(value: datetime) -> datetime:
    return value.replace(hour=0, minute=0, second=0, microsecond=0)


def _start_of_week(value: datetime) -> datetime:
    start = _start_of_day(value)
    return start - timedelta(days=start.weekday())


def _week_dates(week_start: datetime) -> list[datetime]:
    return [week_start + timedelta(days=index) for index in range(7)]


def _comparable_datetime(value: datetime) -> datetime:
    return value.replace(tzinfo=None) if value.tzinfo else value


def _time_bucket(value: datetime) -> str:
    hour = value.hour
    if 5 <= hour < 12:
        return "morning"
    if 12 <= hour < 17:
        return "afternoon"
    if 17 <= hour < 21:
        return "evening"
    return "late evening"


def _completion_percent(completed_count: int, total_count: int) -> float:
    if total_count <= 0:
        return 0
    return round((completed_count / total_count) * 100, 2)


def _average_completion_percent(sessions: list[WorkSession]) -> float:
    values = [
        (
            item.quality_score
            if item.quality_score > 0
            else calculate_session_quality(item)[0]
        )
        for item in sessions
        if item.actual_end is not None or item.status == SessionStatus.missed
    ]
    if not values:
        return 0
    return round(sum(values) / len(values), 2)


def _percent_change(current: float, previous: float) -> float | None:
    if previous <= 0:
        return None
    return round(((current - previous) / previous) * 100, 2)


def _trend_sort_key(item: ProgressTrendResponse) -> tuple[float, float, str]:
    return (
        float(item.current_time_spent_minutes or 0),
        float(item.session_count or 0),
        item.label.lower(),
    )


class ReportingService:
    def __init__(self) -> None:
        self.metrics = MetricsService()
        self.behavior = BehaviorService()
        self.advisor = AdvisorService()
        self.tracker = TrackerService()

    def weekly_report(
        self,
        db: Session,
        period_start: datetime,
        period_end: datetime,
    ) -> WeeklyReportResponse:
        self.tracker.sync_overdue_sessions(db, period_end)
        effective_sessions = self._sessions_for_period(db, period_start, period_end)
        week_start = _start_of_week(period_start)
        week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
        week_sessions = self._sessions_for_period(db, week_start, week_end)
        previous_sessions = self._sessions_for_period(
            db,
            period_start - timedelta(days=7),
            period_end - timedelta(days=7),
        )
        tasks = {task.id: task for task in db.exec(select(Task)).all()}
        task_hours: dict[str, float] = {}
        habits = self.behavior.weekly_patterns(db, period_start, period_end)

        for item in effective_sessions:
            label = self._task_title(tasks, item.task_id)
            task_hours[label] = round(
                task_hours.get(label, 0)
                + (minutes_between(item.actual_start, item.actual_end) / 60),
                2,
            )

        self._upsert_weekly_progress_memory(
            db,
            self._build_progress_memory(
                sessions=week_sessions,
                habits=habits,
                period_start=week_start,
                period_end=week_end,
            ),
        )
        advisory = self.advisor.generate(db, period_start, period_end)
        category_objectives = self._build_category_objectives(
            week_sessions=week_sessions,
            tasks=tasks,
            period_end=period_end,
            week_start=week_start,
        )
        category_trends = self._build_trends(
            sessions=effective_sessions,
            previous_sessions=previous_sessions,
            tasks=tasks,
            period_start=period_start,
            period_end=period_end,
            mode="category",
        )
        repeated_session_trends = self._build_trends(
            sessions=effective_sessions,
            previous_sessions=previous_sessions,
            tasks=tasks,
            period_start=period_start,
            period_end=period_end,
            mode="session",
        )
        recommendations = list(
            dict.fromkeys(
                advisory.focus_areas
                + advisory.schedule_improvements
                + self._build_trend_recommendations(
                    category_objectives=category_objectives,
                    category_trends=category_trends,
                    repeated_session_trends=repeated_session_trends,
                )
            )
        )

        return WeeklyReportResponse(
            period_start=period_start,
            period_end=period_end,
            metrics=self.metrics.compute_metrics(db, period_start, period_end),
            habits=habits,
            task_hours=task_hours,
            category_objectives=category_objectives,
            category_trends=category_trends,
            repeated_session_trends=repeated_session_trends,
            reflection_summary=self._build_reflection_summary(effective_sessions),
            streaks=self._build_streaks(db, period_end),
            timeline=self._build_timeline(effective_sessions, tasks),
            recommendations=recommendations,
            advisor=advisory,
        )

    def _sessions_for_period(
        self,
        db: Session,
        period_start: datetime,
        period_end: datetime,
    ) -> list[WorkSession]:
        return list(
            db.exec(
                select(WorkSession).where(
                    WorkSession.planned_start >= period_start,
                    WorkSession.planned_end <= period_end,
                )
            ).all()
        )

    def _task_title(self, tasks: dict[int | None, Task], task_id: int) -> str:
        task = tasks.get(task_id)
        return task.title if task else f"Task {task_id}"

    def _task_category(self, tasks: dict[int | None, Task], task_id: int) -> str:
        return resolve_task_category(tasks.get(task_id))

    def _objective_text(self, session: WorkSession, tasks: dict[int | None, Task]) -> str:
        if session.objective and session.objective.strip():
            return session.objective.strip()
        task = tasks.get(session.task_id)
        if task and task.objective and task.objective.strip():
            return task.objective.strip()
        return ""

    def _objective_sessions(
        self,
        sessions: list[WorkSession],
        tasks: dict[int | None, Task],
    ) -> list[WorkSession]:
        return [
            item
            for item in sessions
            if self._objective_text(item, tasks)
        ]

    def _completion_time(self, session: WorkSession) -> datetime:
        return (
            session.actual_end
            or session.actual_start
            or session.planned_end
            or session.planned_start
        )

    def _is_objective_completed(self, session: WorkSession) -> bool:
        return bool(session.objective_completed)

    def _is_completed_by(self, session: WorkSession, cutoff: datetime) -> bool:
        if not self._is_objective_completed(session):
            return False
        return _comparable_datetime(self._completion_time(session)) <= _comparable_datetime(
            cutoff
        )

    def _session_quality_score(self, session: WorkSession) -> float:
        if session.quality_score > 0 or session.status == SessionStatus.missed:
            return float(session.quality_score)
        return calculate_session_quality(session)[0]

    def _session_quality_label(self, session: WorkSession) -> SessionQualityLabel:
        calculated_label = calculate_session_quality(session)[1]
        if session.quality_score > 0:
            value = (
                session.quality_label.value
                if hasattr(session.quality_label, "value")
                else str(session.quality_label or "")
            )
            value = value.strip().lower()
            if not value or (
                value == SessionQualityLabel.failed.value
                and calculated_label != SessionQualityLabel.failed
            ):
                return calculated_label

        if session.quality_label and str(session.quality_label).strip():
            value = (
                session.quality_label.value
                if hasattr(session.quality_label, "value")
                else str(session.quality_label)
            )
            value = value.strip().lower()
            try:
                return SessionQualityLabel(value)
            except ValueError:
                pass
        return calculated_label

    def _reflection_outcome(self, session: WorkSession) -> str:
        if session.reflection_notes and session.reflection_notes.strip():
            return session.reflection_notes.strip()
        if session.status == SessionStatus.missed:
            return "Session missed."
        if session.objective_completed:
            return "Objective completed."
        return "Objective not completed."

    def _build_reflection_summary(
        self,
        sessions: list[WorkSession],
    ) -> ReflectionSummaryResponse:
        failure_counts: dict[str, int] = defaultdict(int)
        distraction_counts: dict[str, int] = defaultdict(int)

        for session in sessions:
            if session.objective_completed:
                continue
            if session.failure_reason:
                label = (
                    session.failure_reason.value
                    if hasattr(session.failure_reason, "value")
                    else str(session.failure_reason)
                )
                failure_counts[label] += 1
            if session.distraction_category and session.distraction_category.strip():
                distraction_counts[session.distraction_category.strip()] += 1

        top_failure_reason, top_failure_reason_count = (
            max(
                failure_counts.items(),
                key=lambda item: (item[1], item[0].lower()),
            )
            if failure_counts
            else (None, 0)
        )
        top_distraction_category, top_distraction_count = (
            max(
                distraction_counts.items(),
                key=lambda item: (item[1], item[0].lower()),
            )
            if distraction_counts
            else (None, 0)
        )

        return ReflectionSummaryResponse(
            top_failure_reason=top_failure_reason,
            top_failure_reason_count=top_failure_reason_count,
            top_distraction_category=top_distraction_category,
            top_distraction_count=top_distraction_count,
        )

    def _build_timeline(
        self,
        sessions: list[WorkSession],
        tasks: dict[int | None, Task],
    ) -> list[WeeklyTimelineItem]:
        timeline: list[WeeklyTimelineItem] = []
        for item in sorted(sessions, key=lambda session: session.planned_start):
            failure_reason = (
                item.failure_reason.value
                if getattr(item.failure_reason, "value", None)
                else (str(item.failure_reason) if item.failure_reason else None)
            )
            timeline.append(
                WeeklyTimelineItem(
                    session_id=item.id,
                    title=self._task_title(tasks, item.task_id),
                    category=self._task_category(tasks, item.task_id),
                    planned_start=item.planned_start,
                    planned_end=item.planned_end,
                    actual_start=item.actual_start,
                    actual_end=item.actual_end,
                    objective=self._objective_text(item, tasks),
                    actual_outcome=self._reflection_outcome(item),
                    status=item.status,
                    objective_completed=bool(item.objective_completed),
                    failure_reason=failure_reason,
                    distraction_category=item.distraction_category,
                    start_delta_minutes=item.start_delta_minutes,
                    quality_score=self._session_quality_score(item),
                    quality_label=self._session_quality_label(item),
                )
            )

        return timeline

    def _build_streaks(
        self,
        db: Session,
        period_end: datetime,
    ) -> StreakSummaryResponse:
        sessions = list(
            db.exec(select(WorkSession).order_by(WorkSession.planned_start)).all()
        )
        cutoff = _comparable_datetime(period_end)
        historical_sessions = [
            item
            for item in sessions
            if _comparable_datetime(item.planned_start) <= cutoff
        ]

        completed_dates = sorted(
            {
                _start_of_day(item.planned_start)
                for item in historical_sessions
                if item.objective_completed
            }
        )
        longest_day_streak = 0
        current_day_run = 0
        previous_date: datetime | None = None
        for date in completed_dates:
            if previous_date and (date - previous_date).days == 1:
                current_day_run += 1
            else:
                current_day_run = 1
            longest_day_streak = max(longest_day_streak, current_day_run)
            previous_date = date

        target_day = _start_of_day(period_end)
        completed_days = {item for item in completed_dates}
        current_day_streak = 0
        cursor = target_day
        while cursor in completed_days:
            current_day_streak += 1
            cursor = cursor - timedelta(days=1)

        closed_sessions = [
            item
            for item in historical_sessions
            if item.actual_end is not None or item.status == SessionStatus.missed
        ]
        longest_session_streak = 0
        running_session_streak = 0
        for item in closed_sessions:
            if item.objective_completed:
                running_session_streak += 1
                longest_session_streak = max(longest_session_streak, running_session_streak)
            else:
                running_session_streak = 0

        current_session_streak = 0
        for item in reversed(closed_sessions):
            if item.objective_completed:
                current_session_streak += 1
                continue
            break

        return StreakSummaryResponse(
            completed_days=StreakMetric(
                current=current_day_streak,
                longest=longest_day_streak,
            ),
            completed_sessions=StreakMetric(
                current=current_session_streak,
                longest=longest_session_streak,
            ),
        )

    def _build_progress_memory(
        self,
        sessions: list[WorkSession],
        habits: list,
        period_start: datetime,
        period_end: datetime,
    ) -> WeeklyProgressMemory:
        objective_sessions = [
            item
            for item in sessions
            if item.objective and item.objective.strip()
        ]
        completed_objectives = sum(1 for item in objective_sessions if item.objective_completed)
        closed_sessions = [
            item
            for item in sessions
            if item.actual_end is not None or item.status == SessionStatus.missed
        ]
        average_quality_score = _average_completion_percent(closed_sessions)
        missed_sessions = [item for item in sessions if item.status == SessionStatus.missed]
        reflection_summary = self._build_reflection_summary(sessions)
        bucket_counts: dict[str, int] = defaultdict(int)
        for item in missed_sessions:
            bucket_counts[_time_bucket(item.planned_start)] += 1
        weakest_time_bucket = None
        if bucket_counts:
            top_bucket, top_count = max(
                bucket_counts.items(),
                key=lambda item: (item[1], item[0]),
            )
            weakest_time_bucket = top_bucket if top_count >= 2 else None

        return WeeklyProgressMemory(
            week_start=period_start,
            week_end=period_end,
            objective_completion_rate=_completion_percent(
                completed_objectives,
                len(objective_sessions),
            ),
            completed_objectives=completed_objectives,
            objective_total=len(objective_sessions),
            missed_sessions=len(missed_sessions),
            average_quality_score=average_quality_score,
            top_failure_reason=reflection_summary.top_failure_reason,
            top_distraction_category=reflection_summary.top_distraction_category,
            weakest_time_bucket=weakest_time_bucket,
        )

    def _upsert_weekly_progress_memory(
        self,
        db: Session,
        memory: WeeklyProgressMemory,
    ) -> None:
        existing = db.exec(
            select(WeeklyProgressMemory).where(
                WeeklyProgressMemory.week_start == memory.week_start
            )
        ).first()
        if existing:
            existing.week_end = memory.week_end
            existing.objective_completion_rate = memory.objective_completion_rate
            existing.completed_objectives = memory.completed_objectives
            existing.objective_total = memory.objective_total
            existing.missed_sessions = memory.missed_sessions
            existing.average_quality_score = memory.average_quality_score
            existing.top_failure_reason = memory.top_failure_reason
            existing.top_distraction_category = memory.top_distraction_category
            existing.weakest_time_bucket = memory.weakest_time_bucket
            existing.updated_at = datetime.now()
            db.add(existing)
        else:
            db.add(memory)
        db.commit()

    def _build_category_objectives(
        self,
        week_sessions: list[WorkSession],
        tasks: dict[int | None, Task],
        period_end: datetime,
        week_start: datetime,
    ) -> list[CategoryObjectiveSummary]:
        grouped: dict[str, list[WorkSession]] = defaultdict(list)
        for item in self._objective_sessions(week_sessions, tasks):
            grouped[self._task_category(tasks, item.task_id)].append(item)

        summaries: list[CategoryObjectiveSummary] = []
        for category, items in sorted(
            grouped.items(),
            key=lambda entry: (-len(entry[1]), entry[0].lower()),
        ):
            total_count = len(items)
            completed_count = sum(
                1 for item in items if self._is_completed_by(item, period_end)
            )
            progress_points = self._build_objective_progress_points(
                items=items,
                period_end=period_end,
                week_start=week_start,
            )

            summaries.append(
                CategoryObjectiveSummary(
                    category=category,
                    objective_count=total_count,
                    completed_objectives=completed_count,
                    target_total=total_count,
                    completed_total=completed_count,
                    completion_percent=_completion_percent(
                        completed_count,
                        total_count,
                    ),
                    progress_by_day=progress_points,
                )
            )

        return summaries

    def _build_objective_progress_points(
        self,
        items: list[WorkSession],
        period_end: datetime,
        week_start: datetime,
    ) -> list[ObjectiveProgressPoint]:
        progress_points: list[ObjectiveProgressPoint] = []

        for day in _week_dates(week_start):
            day_start = _start_of_day(day)
            day_end = day_start + timedelta(days=1)

            if _comparable_datetime(day_start) > _comparable_datetime(period_end):
                progress_points.append(
                    ObjectiveProgressPoint(
                        label=day.strftime("%a"),
                        completion_percent=0,
                        objective_count=0,
                        completed_objectives=0,
                    )
                )
                continue

            day_items = [
                item
                for item in items
                if _comparable_datetime(day_start)
                <= _comparable_datetime(item.planned_start)
                < _comparable_datetime(day_end)
                and _comparable_datetime(item.planned_start)
                <= _comparable_datetime(period_end)
            ]
            day_total = len(day_items)
            day_completed = sum(
                1 for item in day_items if self._is_objective_completed(item)
            )
            progress_points.append(
                ObjectiveProgressPoint(
                    label=day.strftime("%a"),
                    completion_percent=_completion_percent(day_completed, day_total),
                    objective_count=day_total,
                    completed_objectives=day_completed,
                )
            )

        return progress_points

    def _build_trends(
        self,
        sessions: list[WorkSession],
        previous_sessions: list[WorkSession],
        tasks: dict[int | None, Task],
        period_start: datetime,
        period_end: datetime,
        mode: str,
    ) -> list[ProgressTrendResponse]:
        week_start = _start_of_week(period_start)
        week_dates = _week_dates(week_start)
        current_groups: dict[str, list[WorkSession]] = defaultdict(list)
        previous_groups: dict[str, list[WorkSession]] = defaultdict(list)

        for item in self._objective_sessions(sessions, tasks):
            key = (
                self._task_category(tasks, item.task_id)
                if mode == "category"
                else self._task_title(tasks, item.task_id)
            )
            current_groups[key].append(item)

        for item in self._objective_sessions(previous_sessions, tasks):
            key = (
                self._task_category(tasks, item.task_id)
                if mode == "category"
                else self._task_title(tasks, item.task_id)
            )
            previous_groups[key].append(item)

        labels = set(current_groups) | set(previous_groups)
        trends: list[ProgressTrendResponse] = []

        for label in labels:
            current_items = current_groups.get(label, [])
            previous_items = previous_groups.get(label, [])
            if mode == "session" and len(current_items) + len(previous_items) < 2:
                continue

            current_completed = sum(
                1 for item in current_items if self._is_objective_completed(item)
            )
            previous_completed = sum(
                1 for item in previous_items if self._is_objective_completed(item)
            )
            current_completion_rate = _completion_percent(
                current_completed,
                len(current_items),
            )
            previous_completion_rate = _completion_percent(
                previous_completed,
                len(previous_items),
            )
            current_minutes = round(
                sum(minutes_between(item.actual_start, item.actual_end) for item in current_items),
                2,
            )
            previous_minutes = round(
                sum(
                    minutes_between(item.actual_start, item.actual_end)
                    for item in previous_items
                ),
                2,
            )
            current_performance = _average_completion_percent(current_items)
            previous_performance = _average_completion_percent(previous_items)

            daily: list[TrendPoint] = []
            for day in week_dates:
                day_start = _start_of_day(day)
                day_end = day_start + timedelta(days=1)
                day_sessions = [
                    item
                    for item in current_items
                    if _comparable_datetime(day_start)
                    <= _comparable_datetime(item.planned_start)
                    < _comparable_datetime(day_end)
                    and _comparable_datetime(item.planned_start)
                    <= _comparable_datetime(period_end)
                ]
                daily.append(
                    TrendPoint(
                        label=day.strftime("%a"),
                        completed_sessions=sum(
                            1
                            for item in day_sessions
                            if self._is_objective_completed(item)
                        ),
                        time_spent_minutes=round(
                            sum(
                                minutes_between(item.actual_start, item.actual_end)
                                for item in day_sessions
                            ),
                            2,
                        ),
                        performance_percent=_average_completion_percent(day_sessions),
                    )
                )

            trends.append(
                ProgressTrendResponse(
                    label=label,
                    session_count=len(current_items),
                    current_completed_sessions=current_completed,
                    previous_completed_sessions=previous_completed,
                    current_completion_rate=current_completion_rate,
                    previous_completion_rate=previous_completion_rate,
                    completion_change_percent=_percent_change(
                        current_completion_rate,
                        previous_completion_rate,
                    ),
                    current_time_spent_minutes=current_minutes,
                    previous_time_spent_minutes=previous_minutes,
                    time_change_percent=_percent_change(
                        current_minutes,
                        previous_minutes,
                    ),
                    current_performance_percent=current_performance,
                    previous_performance_percent=previous_performance,
                    performance_change_percent=_percent_change(
                        current_performance,
                        previous_performance,
                    ),
                    daily=daily,
                )
            )

        trends.sort(key=_trend_sort_key, reverse=True)
        return trends[:6]

    def _build_trend_recommendations(
        self,
        category_objectives: list[CategoryObjectiveSummary],
        category_trends: list[ProgressTrendResponse],
        repeated_session_trends: list[ProgressTrendResponse],
    ) -> list[str]:
        notes: list[str] = []

        weakest_category = next(
            (
                item
                for item in category_trends
                if (item.completion_change_percent or 0) <= -10
                or (item.performance_change_percent or 0) <= -10
            ),
            None,
        )
        if weakest_category:
            notes.append(
                f"{weakest_category.label} is trending down. Reduce scope or shorten those sessions next week."
            )

        strongest_category = next(
            (
                item
                for item in category_trends
                if (item.completion_change_percent or 0) >= 10
                or (item.performance_change_percent or 0) >= 10
            ),
            None,
        )
        if strongest_category:
            notes.append(
                f"{strongest_category.label} is improving. Keep the same preparation pattern and time slot next week."
            )

        slipping_repeat = next(
            (
                item
                for item in repeated_session_trends
                if (item.completion_change_percent or 0) <= -10
                or (item.time_change_percent or 0) <= -15
                or (item.performance_change_percent or 0) <= -10
            ),
            None,
        )
        if slipping_repeat:
            notes.append(
                f"{slipping_repeat.label} lost consistency versus the previous week. Break it into smaller repeatable blocks."
            )

        stalled_objectives = next(
            (
                item
                for item in category_objectives
                if item.objective_count > 0 and item.completion_percent < 50
            ),
            None,
        )
        if stalled_objectives:
            notes.append(
                f"{stalled_objectives.category} objectives are only {round(stalled_objectives.completion_percent)}% complete. Trim the target count or schedule a dedicated recovery block."
            )

        return notes

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
        if report.advisor.weekly_feedback.narrative:
            lines.extend(
                [
                    "Advisor reflection:",
                    report.advisor.weekly_feedback.narrative,
                ]
            )
        lines.extend(
            [
                f"- {item.category}: {item.count} misses / {item.minutes_lost} minutes lost"
                for item in report.habits
            ]
        )
        return "\n".join(lines)

    def export_excel(self, report: WeeklyReportResponse) -> bytes:
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Weekly Report"
        sheet.append(["Metric", "Value"])
        sheet.append(["Signal %", report.metrics.signal_percent])
        sheet.append(["Performance %", report.metrics.performance_percent])
        sheet.append(["Punctuality %", report.metrics.punctuality_rate])
        sheet.append(["Average lateness", report.metrics.average_lateness_minutes])
        sheet.append(["Discipline score", report.metrics.discipline_score])

        sheet.append([])
        sheet.append(["Habit", "Misses", "Minutes Lost"])
        for item in report.habits:
            sheet.append([item.category, item.count, item.minutes_lost])

        output = BytesIO()
        workbook.save(output)
        return output.getvalue()
