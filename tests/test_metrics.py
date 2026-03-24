from datetime import datetime, timedelta

from backend.app.metrics import calculate_lateness, calculate_performance, calculate_signal


def test_calculate_signal_returns_percentage() -> None:
    assert calculate_signal(120, 90) == 75.0


def test_calculate_performance_averages_completion() -> None:
    assert calculate_performance([100, 50, 75]) == 75.0


def test_calculate_lateness_never_negative() -> None:
    planned = datetime(2026, 3, 20, 9, 0, 0)
    early = planned - timedelta(minutes=5)
    assert calculate_lateness(planned, early) == 0
    assert calculate_lateness(planned, planned + timedelta(minutes=12)) == 12.0
