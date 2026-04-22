import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  getTaskCategoryLabel,
  getTaskGoalContext,
} from '../services/executionLoop.js';
import { validateSessionTimeRange } from '../services/plannerValidation.js';

const WEEKLY_PLANNER_LOG_PREFIX = '[weeklyPlanner]';

function logWeeklyPlannerInfo(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.info(`${WEEKLY_PLANNER_LOG_PREFIX} ${message}`, details);
    return;
  }

  console.info(`${WEEKLY_PLANNER_LOG_PREFIX} ${message}`);
}

function logWeeklyPlannerError(
  message: string,
  error: unknown,
  details?: Record<string, unknown>,
) {
  if (details) {
    console.error(`${WEEKLY_PLANNER_LOG_PREFIX} ${message}`, details, error);
    return;
  }

  console.error(`${WEEKLY_PLANNER_LOG_PREFIX} ${message}`, error);
}

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function addMonths(value: Date, months: number) {
  const date = new Date(value);
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  return date;
}

function startOfWeek(value: Date) {
  const date = startOfDay(value);
  const dow = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dow);
  return date;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0);
}

function isDateInRange(value: Date, start: Date, end: Date) {
  const time = startOfDay(value).getTime();
  return time >= startOfDay(start).getTime() && time <= startOfDay(end).getTime();
}

function formatDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonthKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function parseDateKey(value: string) {
  const [yearText, monthText, dayText] = String(value).split('-');
  return new Date(Number(yearText), Number(monthText) - 1, Number(dayText));
}

function parseMonthKey(value: string) {
  const [yearText, monthText] = String(value).split('-');
  return new Date(Number(yearText), Number(monthText) - 1, 1);
}

function getWeekKey(value: Date) {
  return formatDateKey(startOfWeek(value));
}

function formatMonthLabel(value: Date) {
  return value.toLocaleDateString([], {
    month: 'long',
    year: 'numeric',
  });
}

function formatWeekRange(start: Date, end: Date) {
  const sameYear = start.getFullYear() === end.getFullYear();
  const left = start.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const right = end.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return `${left} - ${right}`;
}

function formatDayHeader(value: Date) {
  return value.toLocaleDateString([], {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDayChoice(value: Date) {
  return value.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeInput(value: string) {
  const date = new Date(value);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function normalizeIdentifier(value: unknown) {
  const parsedValue = Number(value);
  return Number.isInteger(parsedValue) ? parsedValue : null;
}

function formatLocalDateTime(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hour = String(value.getHours()).padStart(2, '0');
  const minute = String(value.getMinutes()).padStart(2, '0');
  const second = String(value.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function parseTimeParts(timeText: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(timeText).trim());
  if (!match) {
    throw new Error('Use HH:MM for planner times.');
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error('Planner times must be valid 24-hour values.');
  }

  return { hour, minute };
}

function buildSessionRange(baseDate: Date, startText: string, endText: string, now = new Date()) {
  const today = startOfDay(now);
  const targetDate = startOfDay(baseDate);
  if (targetDate.getTime() < today.getTime()) {
    throw new Error('Past planner days are review-only.');
  }

  const { hour: startHour, minute: startMinute } = parseTimeParts(startText);
  const { hour: endHour, minute: endMinute } = parseTimeParts(endText);
  const start = new Date(targetDate);
  const end = new Date(targetDate);

  start.setHours(startHour, startMinute, 0, 0);
  end.setHours(endHour, endMinute, 0, 0);

  if (end <= start) {
    throw new Error('End time must be after start time.');
  }

  if (targetDate.getTime() === today.getTime() && start <= now) {
    throw new Error('For today, choose a start time later than now.');
  }

  return {
    startIso: formatLocalDateTime(start),
    endIso: formatLocalDateTime(end),
  };
}

function getCategoryGoalChoices(categoryGoals: Record<string, string[]>, category: string) {
  const normalizedCategory = String(category || '').trim().toLowerCase();
  if (!normalizedCategory) {
    return [];
  }

  for (const [existingCategory, goals] of Object.entries(categoryGoals || {})) {
    if (String(existingCategory).trim().toLowerCase() === normalizedCategory) {
      return Array.isArray(goals)
        ? goals
            .map((goal) => String(goal || '').trim())
            .filter(Boolean)
        : [];
    }
  }

  return [];
}

function getMonthSessions(sessions: any[], month: Date | string) {
  const monthKey = typeof month === 'string' ? month : formatMonthKey(month);
  return sessions.filter((session: any) => {
    const sessionDate = new Date(session.plannedStart);
    return (
      !Number.isNaN(sessionDate.getTime()) &&
      formatMonthKey(sessionDate) === monthKey
    );
  });
}

function getWeekOptions(month: Date) {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const weeks: Array<{ key: string; start: Date; end: Date }> = [];
  let cursor = startOfWeek(monthStart);

  while (cursor.getTime() <= monthEnd.getTime()) {
    const start = new Date(cursor);
    weeks.push({
      key: formatDateKey(start),
      start,
      end: addDays(start, 6),
    });
    cursor = addDays(cursor, 7);
  }

  return weeks;
}

function getDefaultWeekKey(
  weeks: Array<{ key: string; start: Date; end: Date }>,
  sessions: any[],
  referenceDate: Date,
) {
  const currentWeek = weeks.find((week) =>
    isDateInRange(referenceDate, week.start, week.end),
  );
  if (currentWeek) {
    return currentWeek.key;
  }

  for (let index = weeks.length - 1; index >= 0; index -= 1) {
    const week = weeks[index];
    const hasSessions = sessions.some((session) => {
      const date = new Date(session.plannedStart);
      return !Number.isNaN(date.getTime()) && isDateInRange(date, week.start, week.end);
    });

    if (hasSessions) {
      return week.key;
    }
  }

  return weeks[0]?.key ?? null;
}

export default function WeeklyPlanner({
  sessions,
  tasks,
  categoryGoals = {},
  onCreate,
  onUpdate,
  onDelete,
  onWeekChange,
  activeWeekKey = null,
  activeMonthKey = null,
  isUiLocked,
  isActionPending,
  defaultReminderOffsetMinutes = 5,
  editRequest = null,
  plannerStatusMessage = null,
}: any) {
  const normalizeReminderOffset = (value: unknown) => {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return 5;
    }

    return parsedValue;
  };

  const [referenceNow] = useState(() => new Date());
  const today = startOfDay(referenceNow);
  const currentMonthKey = formatMonthKey(startOfMonth(referenceNow));
  const currentWeekKey = getWeekKey(referenceNow);

  const [selectedMonthKey, setSelectedMonthKey] = useState(
    () => activeMonthKey || currentMonthKey,
  );
  const [selectedWeekKey, setSelectedWeekKey] = useState(
    () => activeWeekKey || currentWeekKey,
  );
  const [modalDateKey, setModalDateKey] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [category, setCategory] = useState('');
  const [objective, setObjective] = useState('');
  const [goalContext, setGoalContext] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [reminderOffsetMinutes, setReminderOffsetMinutes] = useState(
    normalizeReminderOffset(defaultReminderOffsetMinutes),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const syncedMonthKeyRef = useRef(activeMonthKey);
  const syncedWeekKeyRef = useRef(activeWeekKey);
  const lastWeekChangeNotificationRef = useRef<string | null>(null);
  const bootstrapLoggedRef = useRef(false);
  const editingSessionDebugRef = useRef<{
    sessionId: number | null;
    taskId: number | null;
    scheduleBlockId: number | null;
  }>({
    sessionId: null,
    taskId: null,
    scheduleBlockId: null,
  });

  useEffect(() => {
    const previousMonthKey = syncedMonthKeyRef.current;
    syncedMonthKeyRef.current = activeMonthKey;

    if (activeMonthKey && activeMonthKey !== previousMonthKey) {
      setSelectedMonthKey(activeMonthKey);
    }
  }, [activeMonthKey]);

  const selectedMonth = useMemo(
    () => parseMonthKey(selectedMonthKey),
    [selectedMonthKey],
  );

  const weekOptions = useMemo(() => getWeekOptions(selectedMonth), [selectedMonth]);

  useEffect(() => {
    const previousWeekKey = syncedWeekKeyRef.current;
    syncedWeekKeyRef.current = activeWeekKey;

    if (activeWeekKey && activeWeekKey !== previousWeekKey) {
      setSelectedWeekKey(activeWeekKey);
    }
  }, [activeWeekKey]);

  useEffect(() => {
    if (!weekOptions.length) {
      return;
    }

    const activeWeek = weekOptions.find((week) => week.key === selectedWeekKey);
    if (activeWeek) {
      return;
    }

    const monthSessions = getMonthSessions(sessions, selectedMonth);
    const nextWeekKey =
      getDefaultWeekKey(weekOptions, monthSessions, referenceNow) ?? weekOptions[0].key;
    setSelectedWeekKey(nextWeekKey);
  }, [referenceNow, selectedMonth, selectedWeekKey, sessions, weekOptions]);

  const groupedByDate = useMemo(() => {
    const data: Record<string, any[]> = {};

    for (const session of sessions) {
      const date = new Date(session.plannedStart);
      if (Number.isNaN(date.getTime())) {
        continue;
      }

      const key = formatDateKey(date);
      if (!data[key]) {
        data[key] = [];
      }
      data[key].push(session);
    }

    for (const dateKey of Object.keys(data)) {
      data[dateKey].sort(
        (left, right) =>
          new Date(left.plannedStart).getTime() - new Date(right.plannedStart).getTime(),
      );
    }

    return data;
  }, [sessions]);

  const taskMap = useMemo(
    () => new Map<number, any>(tasks.map((task: any) => [Number(task.id), task])),
    [tasks],
  );

  const selectedWeek =
    weekOptions.find((week) => week.key === selectedWeekKey) ?? weekOptions[0] ?? null;
  const categoryGoalChoices = useMemo(
    () => getCategoryGoalChoices(categoryGoals, category),
    [category, categoryGoals],
  );

  const selectedWeekDates = useMemo(() => {
    if (!selectedWeek) {
      return [];
    }

    return Array.from({ length: 7 }, (_, index) => addDays(selectedWeek.start, index));
  }, [selectedWeek]);

  useEffect(() => {
    if (!selectedWeek || !onWeekChange) {
      return;
    }

    const notificationKey = `${selectedMonthKey}:${selectedWeek.key}`;
    if (lastWeekChangeNotificationRef.current === notificationKey) {
      return;
    }

    lastWeekChangeNotificationRef.current = notificationKey;

    try {
      logWeeklyPlannerInfo('weekly planner/session bootstrap', {
        selectedMonthKey,
        selectedWeekKey: selectedWeek.key,
        sessionCount: sessions.length,
        taskCount: tasks.length,
      });
      onWeekChange({
        key: selectedWeek.key,
        start: new Date(selectedWeek.start),
        end: new Date(selectedWeek.end),
        label: formatWeekRange(selectedWeek.start, selectedWeek.end),
        monthKey: selectedMonthKey,
      });
    } catch (nextError) {
      logWeeklyPlannerError(
        'weekly planner/session bootstrap failed',
        nextError,
        {
          selectedMonthKey,
          selectedWeekKey: selectedWeek.key,
        },
      );
    }
  }, [onWeekChange, selectedMonthKey, selectedWeek]);

  useEffect(() => {
    if (bootstrapLoggedRef.current) {
      return;
    }

    bootstrapLoggedRef.current = true;
    logWeeklyPlannerInfo('init', {
      activeMonthKey,
      activeWeekKey,
      sessionCount: sessions.length,
      taskCount: tasks.length,
    });
  }, [activeMonthKey, activeWeekKey, sessions.length, tasks.length]);

  const selectMonth = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthKey = formatMonthKey(monthStart);
    const weeks = getWeekOptions(monthStart);
    const nextWeekKey =
      getDefaultWeekKey(
        weeks,
        getMonthSessions(sessions, monthKey),
        referenceNow,
      ) ??
      weeks[0]?.key ??
      currentWeekKey;

    setSelectedMonthKey(monthKey);
    setSelectedWeekKey(nextWeekKey);
    setFormError(null);
  };

  const goToCurrentWeek = () => {
    setSelectedMonthKey(currentMonthKey);
    setSelectedWeekKey(currentWeekKey);
    setFormError(null);
  };

  useEffect(() => {
    if (!modalDateKey) {
      setReminderOffsetMinutes(
        normalizeReminderOffset(defaultReminderOffsetMinutes),
      );
    }
  }, [defaultReminderOffsetMinutes, modalDateKey]);

  const openCreateForDate = (date: Date) => {
    editingSessionDebugRef.current = {
      sessionId: null,
      taskId: null,
      scheduleBlockId: null,
    };
    setEditingSessionId(null);
    setModalDateKey(formatDateKey(date));
    setTaskId(null);
    setTaskTitle('');
    setCategory('');
    setObjective('');
    setGoalContext('');
    setStartTime('09:00');
    setEndTime('10:00');
    setReminderOffsetMinutes(
      normalizeReminderOffset(defaultReminderOffsetMinutes),
    );
    setFormError(null);
    setSaving(false);
  };

  const openEditor = (session: any) => {
    const sessionId = normalizeIdentifier(session.id);
    const sessionTaskId = normalizeIdentifier(session.taskId ?? session.task_id);
    const scheduleBlockId = normalizeIdentifier(
      session.scheduleBlockId ?? session.schedule_block_id,
    );
    const plannedStartValue = session.plannedStart ?? session.planned_start;
    const plannedEndValue = session.plannedEnd ?? session.planned_end;
    const plannedStartDate = new Date(plannedStartValue);

    logWeeklyPlannerInfo('edit modal open', {
      sessionId,
      taskId: sessionTaskId,
      scheduleBlockId,
      plannedStart: plannedStartValue,
      plannedEnd: plannedEndValue,
    });

    if (!sessionId || Number.isNaN(plannedStartDate.getTime())) {
      logWeeklyPlannerError(
        'edit modal open blocked',
        new Error('Planner edit session is missing a valid session id or start time.'),
        {
          sessionId,
          taskId: sessionTaskId,
          scheduleBlockId,
          plannedStart: plannedStartValue ?? null,
        },
      );
      return;
    }

    editingSessionDebugRef.current = {
      sessionId,
      taskId: sessionTaskId,
      scheduleBlockId,
    };
    setSelectedMonthKey(formatMonthKey(plannedStartDate));
    setSelectedWeekKey(getWeekKey(plannedStartDate));
    setEditingSessionId(sessionId);
    setModalDateKey(formatDateKey(plannedStartDate));
    setTaskId(sessionTaskId);
    setTaskTitle(String(session.title || ''));
    setCategory(
      String(
        session.category ||
          getTaskCategoryLabel(taskMap.get(Number(sessionTaskId))) ||
          '',
      ),
    );
    setObjective(String(session.objectiveText || session.goal || ''));
    setGoalContext(
      String(
        session.goalContext ||
          session.goal_context ||
          getTaskGoalContext(taskMap.get(Number(sessionTaskId))) ||
          '',
      ),
    );
    setStartTime(formatTimeInput(plannedStartValue));
    setEndTime(formatTimeInput(plannedEndValue));
    setReminderOffsetMinutes(
      normalizeReminderOffset(
        session.reminderOffsetMinutes ??
          session.reminder_offset_minutes ??
          defaultReminderOffsetMinutes,
      ),
    );
    setFormError(null);
    setSaving(false);
  };

  useEffect(() => {
    if (editRequest?.session) {
      openEditor(editRequest.session);
    }
  }, [editRequest]);

  const resetForm = () => {
    editingSessionDebugRef.current = {
      sessionId: null,
      taskId: null,
      scheduleBlockId: null,
    };
    setModalDateKey(null);
    setEditingSessionId(null);
    setTaskId(null);
    setTaskTitle('');
    setCategory('');
    setObjective('');
    setGoalContext('');
    setStartTime('09:00');
    setEndTime('10:00');
    setReminderOffsetMinutes(normalizeReminderOffset(defaultReminderOffsetMinutes));
    setFormError(null);
    setSaving(false);
  };

  const save = async () => {
    if (!modalDateKey || saving) {
      return;
    }

    try {
      const normalizedTitle = String(taskTitle || '').trim();
      if (!taskId && !normalizedTitle) {
        throw new Error('Choose a task or enter a task name first.');
      }

      const resolvedEditingSessionId =
        editingSessionId === null ? null : normalizeIdentifier(editingSessionId);
      if (editingSessionId !== null && resolvedEditingSessionId === null) {
        throw new Error('Planner update is missing a valid session id.');
      }

      const { startIso, endIso } = buildSessionRange(
        parseDateKey(modalDateKey),
        startTime,
        endTime,
      );
      const overlapError = validateSessionTimeRange(sessions, {
        startIso,
        endIso,
        excludeSessionId: resolvedEditingSessionId,
      });
      if (overlapError) {
        throw new Error(overlapError);
      }

      setSaving(true);
      setFormError(null);
      const selectedTask =
        taskId === null ? null : taskMap.get(Number(taskId)) ?? null;

      if (resolvedEditingSessionId) {
        logWeeklyPlannerInfo('edit modal save', {
          endpoint: `PUT /sessions/${resolvedEditingSessionId}`,
          sessionId: resolvedEditingSessionId,
          taskId,
          selectedTask,
          originalTaskId: editingSessionDebugRef.current.taskId,
          scheduleBlockId: editingSessionDebugRef.current.scheduleBlockId,
        });
      }

      logWeeklyPlannerInfo('planner modal save payload', {
        sessionId: resolvedEditingSessionId,
        taskId,
        selectedTask,
        taskTitle: normalizedTitle,
        category,
        objective,
        goalContext,
        startIso,
        endIso,
        reminderOffsetMinutes,
      });

      const payload = {
        sessionId: resolvedEditingSessionId,
        taskId,
        selectedTask,
        taskTitle: normalizedTitle,
        category,
        objective,
        goalContext,
        startIso,
        endIso,
        reminderOffsetMinutes,
        local_task_title: normalizedTitle,
        local_task_category: String(category || '').trim(),
      };
      if (editingSessionId) {
        await onUpdate(payload);
      } else {
        await onCreate(payload);
      }
      resetForm();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Failed to save planner session.',
      );
      setSaving(false);
    }
  };

  const selectedDate = modalDateKey ? parseDateKey(modalDateKey) : null;
  const modalChoices =
    selectedWeekDates.length > 0 ? selectedWeekDates : selectedDate ? [selectedDate] : [];

  return (
    <View style={styles.panel}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Weekly Planner</Text>
        <Pressable style={styles.currentWeekButton} onPress={goToCurrentWeek}>
          <Text style={styles.currentWeekText}>Current Week</Text>
        </Pressable>
      </View>
      {plannerStatusMessage ? (
        <Text style={styles.statusBanner}>{plannerStatusMessage}</Text>
      ) : null}

      <Text style={styles.navigationLabel}>Months</Text>
      <View style={styles.monthSelector}>
        <Pressable
          style={styles.monthNavButton}
          onPress={() => selectMonth(addMonths(selectedMonth, -1))}
        >
          <Text style={styles.monthNavButtonText}>Previous</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{formatMonthLabel(selectedMonth)}</Text>
        <Pressable
          style={styles.monthNavButton}
          onPress={() => selectMonth(addMonths(selectedMonth, 1))}
        >
          <Text style={styles.monthNavButtonText}>Next</Text>
        </Pressable>
      </View>

      <Text style={styles.navigationLabel}>Weeks</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.weekRow}>
          {weekOptions.map((week, index) => {
            const active = week.key === selectedWeek?.key;
            return (
              <Pressable
                key={week.key}
                style={[styles.weekTab, active ? styles.weekTabActive : null]}
                onPress={() => {
                  setSelectedWeekKey(week.key);
                  setFormError(null);
                }}
              >
                <Text
                  style={[
                    styles.weekTabTitle,
                    active ? styles.weekTabTitleActive : null,
                  ]}
                >
                  {`Week ${index + 1}`}
                </Text>
                <Text
                  style={[
                    styles.weekTabRange,
                    active ? styles.weekTabRangeActive : null,
                  ]}
                >
                  {formatWeekRange(week.start, week.end)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {selectedWeek ? (
        <Text style={styles.weekSummary}>
          {formatWeekRange(selectedWeek.start, selectedWeek.end)}
        </Text>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.row}>
          {selectedWeekDates.map((date) => {
            const dateKey = formatDateKey(date);
            const daySessions = groupedByDate[dateKey] ?? [];
            const isPastDay = date.getTime() < today.getTime();
            const canCreate = !isPastDay;

            return (
              <View key={dateKey} style={styles.dayCard}>
                <Text style={styles.dayTitle}>
                  {DAYS[(date.getDay() + 6) % 7]}
                </Text>
                <Text style={styles.dayDate}>{formatDayHeader(date)}</Text>
                {daySessions.length === 0 ? (
                  <Text style={styles.empty}>
                    {isPastDay ? 'No sessions recorded' : 'No sessions'}
                  </Text>
                ) : null}
                {daySessions.map((item) => (
                  <View key={item.id} style={styles.sessionItem}>
                    <Text style={styles.sessionTitle}>{item.title}</Text>
                    {item.category ? (
                      <Text style={styles.sessionCategory}>{item.category}</Text>
                    ) : null}
                    <Text style={styles.sessionObjective}>
                      Objective: {item.objectiveText || item.goal || 'Not set'}
                    </Text>
                    <Text style={styles.sessionObjectiveStatus}>
                      Objective status: {item.objectiveStatusLabel || 'Not completed'}
                    </Text>
                    <Text style={styles.sessionTime}>
                      {formatTime(item.plannedStart)} - {formatTime(item.plannedEnd)}
                    </Text>
                    <Text style={styles.sessionStatus}>{item.status.toUpperCase()}</Text>
                    {item.syncStatusLabel ? (
                      <Text style={styles.sessionSyncStatus}>
                        {item.syncStatusLabel}
                      </Text>
                    ) : null}
                    {!isPastDay && item.availableActions?.includes('edit') ? (
                      <Pressable
                        disabled={Boolean(isUiLocked)}
                        style={[
                          styles.editButton,
                          isUiLocked ? styles.disabledButton : null,
                        ]}
                        onPress={() => openEditor(item)}
                      >
                        <Text style={styles.editText}>Edit</Text>
                      </Pressable>
                    ) : null}
                    {!isPastDay && item.availableActions?.includes('delete') ? (
                      <Pressable
                        disabled={Boolean(isUiLocked)}
                        style={[
                          styles.deleteButton,
                          isUiLocked ? styles.disabledButton : null,
                        ]}
                        onPress={() => onDelete?.(item)}
                      >
                        <Text style={styles.deleteText}>
                          {isActionPending?.('delete', item.id) ? 'Deleting...' : 'Delete'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                {canCreate ? (
                  <Pressable
                    style={[
                      styles.addButton,
                      isUiLocked ? styles.disabledButton : null,
                    ]}
                    disabled={Boolean(isUiLocked)}
                    onPress={() => openCreateForDate(date)}
                  >
                    <Text style={styles.addText}>+ Add Session</Text>
                  </Pressable>
                ) : (
                  <View style={styles.reviewBadge}>
                    <Text style={styles.reviewBadgeText}>Review only</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={Boolean(modalDateKey)} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {editingSessionId ? 'Edit Session' : 'Add Session'}
            </Text>
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <Text style={styles.pickLabel}>Day</Text>
            <View style={styles.daySelectorWrap}>
              {modalChoices.map((date) => {
                const dateKey = formatDateKey(date);
                return (
                  <Pressable
                    key={dateKey}
                    disabled={saving}
                    style={[
                      styles.dayChoice,
                      modalDateKey === dateKey ? styles.dayChoiceActive : null,
                      saving ? styles.disabledButton : null,
                    ]}
                    onPress={() => setModalDateKey(dateKey)}
                  >
                    <Text style={styles.dayChoiceText}>{formatDayChoice(date)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Task name"
              placeholderTextColor="#888C94"
              value={taskTitle}
              editable={!saving}
              onChangeText={(value) => {
                const selectedTask = taskMap.get(Number(taskId));
                if (selectedTask && selectedTask.title !== value) {
                  setTaskId(null);
                }
                setTaskTitle(value);
              }}
            />
            <TextInput
              style={styles.input}
              placeholder="Category"
              placeholderTextColor="#888C94"
              value={category}
              editable={!saving}
              onChangeText={setCategory}
            />
            <TextInput
              style={styles.input}
              placeholder="Goal context (optional)"
              placeholderTextColor="#888C94"
              value={goalContext}
              editable={!saving}
              onChangeText={setGoalContext}
            />
            {categoryGoalChoices.length > 0 ? (
              <>
                <Text style={styles.pickLabel}>Stored goals for this category</Text>
                <View style={styles.goalWrap}>
                  {categoryGoalChoices.map((goal) => (
                    <Pressable
                      key={goal}
                      disabled={saving}
                      style={[
                        styles.goalOption,
                        goalContext === goal ? styles.goalOptionActive : null,
                        saving ? styles.disabledButton : null,
                      ]}
                      onPress={() => setGoalContext(goal)}
                    >
                      <Text style={styles.goalOptionText}>{goal}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="Objective / notes"
              placeholderTextColor="#888C94"
              value={objective}
              editable={!saving}
              onChangeText={setObjective}
            />
            <TextInput
              style={styles.input}
              placeholder="Start HH:MM"
              placeholderTextColor="#888C94"
              value={startTime}
              editable={!saving}
              onChangeText={setStartTime}
            />
            <TextInput
              style={styles.input}
              placeholder="End HH:MM"
              placeholderTextColor="#888C94"
              value={endTime}
              editable={!saving}
              onChangeText={setEndTime}
            />
            <Text style={styles.pickLabel}>Reminder timing</Text>
            <View style={styles.reminderWrap}>
              {[
                { label: '5 min before', value: 5 },
                { label: '10 min before', value: 10 },
                { label: '15 min before', value: 15 },
                { label: '30 min before', value: 30 },
                { label: 'None', value: 0 },
              ].map((option) => (
                <Pressable
                  key={option.label}
                  disabled={saving}
                  style={[
                    styles.reminderOption,
                    reminderOffsetMinutes === option.value
                      ? styles.reminderOptionActive
                      : null,
                    saving ? styles.disabledButton : null,
                  ]}
                  onPress={() => setReminderOffsetMinutes(option.value)}
                >
                  <Text style={styles.reminderOptionText}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.pickLabel}>Choose existing task (optional)</Text>
            <ScrollView style={styles.taskList}>
              {tasks.map((task: any) => (
                <Pressable
                  key={task.id}
                  disabled={saving}
                  onPress={() => {
                    setTaskId(task.id);
                    setTaskTitle(task.title);
                    setCategory(getTaskCategoryLabel(task));
                    setGoalContext(getTaskGoalContext(task) || '');
                    setObjective(task.objective || '');
                    setFormError(null);
                  }}
                  style={[
                    styles.taskPick,
                    taskId === task.id ? styles.taskPickActive : null,
                  ]}
                >
                  <Text style={styles.taskPickText}>{task.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.actions}>
              <Pressable
                style={[styles.cancelButton, saving ? styles.disabledButton : null]}
                disabled={saving}
                onPress={resetForm}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, saving ? styles.disabledButton : null]}
                disabled={saving}
                onPress={save}
              >
                <Text style={styles.saveText}>
                  {saving ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#1B1B1B',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  title: { color: '#D6A436', fontSize: 20, fontWeight: '700' },
  currentWeekButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D6A436',
    backgroundColor: '#2A2212',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  currentWeekText: { color: '#F0F0F0', fontSize: 12, fontWeight: '700' },
  statusBanner: {
    color: '#F8D27A',
    backgroundColor: '#2A2212',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  navigationLabel: { color: '#888C94', fontSize: 12, textTransform: 'uppercase' },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  monthNavButton: {
    borderWidth: 1,
    borderColor: '#2F2F2F',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#111111',
  },
  monthNavButtonText: { color: '#F0F0F0', fontSize: 12, fontWeight: '600' },
  monthLabel: {
    color: '#D6A436',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  weekRow: { flexDirection: 'row', gap: 8 },
  weekTab: {
    width: 180,
    backgroundColor: '#171717',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    padding: 10,
    gap: 4,
  },
  weekTabActive: { borderColor: '#D6A436', backgroundColor: '#1E1A11' },
  weekTabTitle: { color: '#F0F0F0', fontWeight: '700' },
  weekTabTitleActive: { color: '#F8D27A' },
  weekTabRange: { color: '#888C94', fontSize: 12 },
  weekTabRangeActive: { color: '#C9AF69' },
  weekSummary: { color: '#888C94', fontSize: 12 },
  row: { flexDirection: 'row', gap: 10 },
  dayCard: {
    width: 240,
    backgroundColor: '#171717',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2E2E2E',
    padding: 10,
    gap: 8,
  },
  dayTitle: { color: '#F0F0F0', fontWeight: '700' },
  dayDate: { color: '#888C94', fontSize: 12 },
  empty: { color: '#888C94' },
  sessionItem: { borderRadius: 10, backgroundColor: '#111111', padding: 8, gap: 2 },
  sessionTitle: { color: '#F0F0F0', fontSize: 13 },
  sessionCategory: { color: '#C9AF69', fontSize: 11, fontWeight: '600' },
  sessionObjective: { color: '#F0F0F0', fontSize: 12 },
  sessionObjectiveStatus: { color: '#888C94', fontSize: 11 },
  sessionTime: { color: '#888C94', fontSize: 12 },
  sessionStatus: { color: '#6F7278', fontSize: 11, fontWeight: '700' },
  sessionSyncStatus: { color: '#F8D27A', fontSize: 11, fontWeight: '600' },
  editButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#888C94',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  editText: { color: '#F0F0F0', fontSize: 12, fontWeight: '600' },
  deleteButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#874040',
    backgroundColor: '#341717',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  deleteText: { color: '#F0F0F0', fontSize: 12, fontWeight: '600' },
  addButton: {
    backgroundColor: '#D6A436',
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
  addText: { color: '#121212', fontWeight: '700' },
  reviewBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2F2F2F',
    paddingVertical: 8,
    alignItems: 'center',
  },
  reviewBadgeText: { color: '#888C94', fontSize: 12, fontWeight: '600' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#161616',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#343434',
  },
  modalTitle: { color: '#D6A436', fontWeight: '700', fontSize: 18 },
  error: {
    color: '#F0F0F0',
    backgroundColor: '#4A2121',
    borderRadius: 8,
    padding: 8,
  },
  input: {
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    color: '#F0F0F0',
    padding: 10,
  },
  pickLabel: { color: '#888C94', marginTop: 4 },
  daySelectorWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChoice: {
    borderWidth: 1,
    borderColor: '#2F2F2F',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dayChoiceActive: { borderColor: '#D6A436', backgroundColor: '#2A2212' },
  dayChoiceText: { color: '#F0F0F0', fontSize: 12, fontWeight: '600' },
  reminderWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reminderOption: {
    borderWidth: 1,
    borderColor: '#2F2F2F',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reminderOptionActive: { borderColor: '#D6A436', backgroundColor: '#2A2212' },
  reminderOptionText: { color: '#F0F0F0', fontSize: 12, fontWeight: '600' },
  goalWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalOption: {
    borderWidth: 1,
    borderColor: '#2F2F2F',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  goalOptionActive: { borderColor: '#D6A436', backgroundColor: '#2A2212' },
  goalOptionText: { color: '#F0F0F0', fontSize: 12, fontWeight: '600' },
  taskList: { maxHeight: 120 },
  taskPick: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2F2F2F',
    marginBottom: 6,
  },
  taskPickActive: { borderColor: '#D6A436' },
  taskPickText: { color: '#F0F0F0' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 6 },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#666',
  },
  cancelText: { color: '#F0F0F0' },
  saveButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#D6A436',
  },
  saveText: { color: '#121212', fontWeight: '700' },
  disabledButton: { opacity: 0.6 },
});
