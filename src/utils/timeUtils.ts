import { DayOfWeek, TimeSlot, Course, AcademicHoliday, ScheduleOverride } from '../types';

export const DAYS_ORDER: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

/**
 * Formats a Date object to YYYY-MM-DD in the user's LOCAL timezone.
 * Avoids the UTC-shift bug where toISOString() yields yesterday/tomorrow during night/early morning hours.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDayName(overrides?: ScheduleOverride[]): DayOfWeek {
  const today = new Date();
  if (overrides && overrides.length > 0) {
    const todayStr = getLocalDateString(today);
    const match = overrides.find((o) => o.date === todayStr);
    if (match) return match.runDaySchedule;
  }
  const dayIndex = today.getDay(); // 0 is Sunday, 1 is Monday...
  const map: Record<number, DayOfWeek> = {
    0: 'Sunday',
    1: 'Monday',
    2: 'Tuesday',
    3: 'Wednesday',
    4: 'Thursday',
    5: 'Friday',
    6: 'Saturday',
  };
  return map[dayIndex] || 'Monday';
}

export function getEffectiveDayOfWeek(
  date: Date = new Date(),
  overrides?: ScheduleOverride[]
): { day: DayOfWeek; isOverride: boolean; overrideReason?: string } {
  const dateStr = getLocalDateString(date);
  const override = overrides?.find((o) => o.date === dateStr);
  if (override) {
    return {
      day: override.runDaySchedule,
      isOverride: true,
      overrideReason: override.reason,
    };
  }
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }) as DayOfWeek;
  return {
    day: dayName,
    isOverride: false,
  };
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function formatTime12h(timeStr: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12; // '0' becomes 12
  return `${h}:${m} ${ampm}`;
}

export function getSlotDurationMultiplier(slot: Partial<TimeSlot>): number {
  if (slot.durationMultiplier && slot.durationMultiplier > 0) {
    return slot.durationMultiplier;
  }
  if (!slot.startTime || !slot.endTime) return 1;
  const startM = parseTimeToMinutes(slot.startTime);
  const endM = parseTimeToMinutes(slot.endTime);
  const duration = endM - startM;
  if (duration >= 140) return 3; // ~3 hours (e.g. 150-180 min lab)
  if (duration >= 80) return 2;  // ~2 hours (e.g. 90-120 min lab)
  return 1;
}

export function isHolidayDate(targetDate: Date, holidays?: AcademicHoliday[]): AcademicHoliday | null {
  if (!holidays || holidays.length === 0) return null;
  const dateStr = getLocalDateString(targetDate);
  return holidays.find((h) => {
    const s = h.startDate.split('T')[0];
    const e = h.endDate.split('T')[0];
    return dateStr >= s && dateStr <= e;
  }) || null;
}

export function playCampusBellChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First tone (E5 ~ 659.25Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.8);

    // Second harmonic tone (A5 ~ 880Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.25);
    gain2.gain.setValueAtTime(0.25, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.25);
    osc2.stop(now + 1.2);
  } catch (err) {
    console.warn('Campus bell chime audio unavailable:', err);
  }
}

export interface CurrentClassStatus {
  currentSlot: TimeSlot | null;
  currentCourse: Course | null;
  nextSlot: TimeSlot | null;
  nextCourse: Course | null;
  minutesRemaining: number;
  progressPercent: number;
  timeUntilNext: number; // Minutes until next class starts
  isHoliday?: boolean;
  holidayTitle?: string;
  isScheduleOverride?: boolean;
  overrideDayName?: DayOfWeek;
  overrideReason?: string;
  isTermEnded?: boolean;
  classesEndDate?: string;
}

/**
 * Determines whether a time slot takes place on a given calendar date,
 * respecting:
 * 1. One-off makeup/extra sessions (specificDate must match targetDate)
 * 2. Day Order Overrides (e.g. Saturday running Monday's timetable)
 * 3. Weekly vs Odd-week vs Even-week recurrence (based on week index from semesterStartDate)
 */
export function isSlotActiveOnDate(
  slot: TimeSlot,
  targetDate: Date,
  semesterStartDate?: string,
  overrides?: ScheduleOverride[]
): boolean {
  const targetDateStr = getLocalDateString(targetDate);

  // 1. One-Off Makeup Class
  if (slot.isOneOff) {
    return slot.specificDate === targetDateStr;
  }

  // If slot has a specific date but is not marked one-off, check if it matches
  if (slot.specificDate && slot.specificDate !== targetDateStr) {
    return false;
  }

  // 2. Day of Week Check (taking into account Schedule Overrides / Day Order swaps)
  const { day: targetDayName } = getEffectiveDayOfWeek(targetDate, overrides);
  if (slot.day !== targetDayName) return false;

  // 3. Recurrence Check (odd_weeks vs even_weeks)
  if (!slot.recurrence || slot.recurrence === 'all') {
    return true;
  }

  // Compute week number from semesterStartDate or start of current year
  const baseDate = semesterStartDate ? new Date(semesterStartDate) : new Date(targetDate.getFullYear(), 0, 1);
  const diffMs = targetDate.getTime() - baseDate.getTime();
  const weekNumber = Math.max(1, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1);

  const isOddWeek = weekNumber % 2 !== 0;

  if (slot.recurrence === 'odd_weeks') {
    return isOddWeek;
  }
  if (slot.recurrence === 'even_weeks') {
    return !isOddWeek;
  }

  return true;
}

export function getCurrentAndNextClass(
  slots: TimeSlot[],
  courses: Course[],
  currentTime: Date = new Date(),
  semesterStartDate?: string,
  holidays?: AcademicHoliday[],
  overrides?: ScheduleOverride[],
  classesEndDate?: string
): CurrentClassStatus {
  if (classesEndDate) {
    const endDateTime = new Date(classesEndDate + 'T23:59:59').getTime();
    if (currentTime.getTime() > endDateTime) {
      return {
        currentSlot: null,
        currentCourse: null,
        nextSlot: null,
        nextCourse: null,
        minutesRemaining: 0,
        progressPercent: 0,
        timeUntilNext: 0,
        isTermEnded: true,
        classesEndDate,
      };
    }
  }

  const activeHoliday = isHolidayDate(currentTime, holidays);
  if (activeHoliday) {
    return {
      currentSlot: null,
      currentCourse: null,
      nextSlot: null,
      nextCourse: null,
      minutesRemaining: 0,
      progressPercent: 0,
      timeUntilNext: 0,
      isHoliday: true,
      holidayTitle: activeHoliday.title,
    };
  }

  const effectiveDayInfo = getEffectiveDayOfWeek(currentTime, overrides);
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  // Filter slots for today respecting one-offs, schedule overrides, and odd/even week recurrence
  const todaySlots = slots
    .filter((s) => isSlotActiveOnDate(s, currentTime, semesterStartDate, overrides))
    .sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));

  let currentSlot: TimeSlot | null = null;
  let nextSlot: TimeSlot | null = null;
  let minutesRemaining = 0;
  let progressPercent = 0;
  let timeUntilNext = 0;

  for (let i = 0; i < todaySlots.length; i++) {
    const slot = todaySlots[i];
    const startM = parseTimeToMinutes(slot.startTime);
    const endM = parseTimeToMinutes(slot.endTime);

    if (currentMinutes >= startM && currentMinutes < endM) {
      currentSlot = slot;
      minutesRemaining = endM - currentMinutes;
      const totalDuration = endM - startM;
      const elapsed = currentMinutes - startM;
      progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));

      // Next slot is the one after current
      if (i + 1 < todaySlots.length) {
        nextSlot = todaySlots[i + 1];
        timeUntilNext = parseTimeToMinutes(nextSlot.startTime) - currentMinutes;
      }
      break;
    } else if (currentMinutes < startM && !nextSlot) {
      nextSlot = slot;
      timeUntilNext = startM - currentMinutes;
    }
  }

  const courseMap = new Map(courses.map((c) => [c.id, c]));

  return {
    currentSlot,
    currentCourse: currentSlot ? courseMap.get(currentSlot.courseId) || null : null,
    nextSlot,
    nextCourse: nextSlot ? courseMap.get(nextSlot.courseId) || null : null,
    minutesRemaining,
    progressPercent,
    timeUntilNext,
    isScheduleOverride: effectiveDayInfo.isOverride,
    overrideDayName: effectiveDayInfo.isOverride ? effectiveDayInfo.day : undefined,
    overrideReason: effectiveDayInfo.overrideReason,
  };
}

export type AttendanceSeverity = 'debarment_risk' | 'college_warning' | 'goal_unreachable' | 'goal_warning' | 'optimal';

export interface AttendanceAnalysis {
  percentage: number;
  isCollegeSafe: boolean;
  isPersonalGoalMet: boolean;
  statusText: string;
  badgeColor: string;
  collegeSafeBunks: number;
  personalGoalSafeBunks: number;
  classesNeededForCollege: number;
  classesNeededForPersonalGoal: number;
  effectivePersonalGoal: number;
  collegeMinRequirement: number;
  remainingClasses?: number;
  termCollegeSafeBunks?: number;
  termPersonalSafeBunks?: number;
  isDebarmentInevitable?: boolean;
  isPersonalGoalUnreachable?: boolean;
  maxPossiblePercentage?: number;
  severityLevel: AttendanceSeverity;
  projectionSummary?: string;
  collegeProjectionSummary?: string;
  goalProjectionSummary?: string;
}

/**
 * Calculates the exact remaining lectures for a specific course between now and classesEndDate,
 * taking into account holidays/institutional breaks, one-offs, and day order overrides.
 */
export function getRemainingClassesForCourse(
  courseId: string,
  timeSlots: TimeSlot[],
  fromDate: Date = new Date(),
  classesEndDateStr?: string,
  holidays?: AcademicHoliday[],
  overrides?: ScheduleOverride[]
): number {
  if (!classesEndDateStr) return 0;
  const endDate = new Date(classesEndDateStr + 'T23:59:59');
  if (fromDate.getTime() >= endDate.getTime()) return 0;

  const holidayDateSet = new Set<string>();
  if (holidays && holidays.length > 0) {
    for (const h of holidays) {
      if (h.isOffDay === false) continue;
      const cur = new Date(h.startDate + 'T00:00:00');
      const hEnd = new Date(h.endDate + 'T23:59:59');
      while (cur.getTime() <= hEnd.getTime()) {
        holidayDateSet.add(getLocalDateString(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }
  }

  const courseSlots = timeSlots.filter((s) => s.courseId === courseId);
  if (courseSlots.length === 0) return 0;

  let count = 0;
  const runner = new Date(fromDate);
  runner.setHours(0, 0, 0, 0);
  runner.setDate(runner.getDate() + 1); // Start projecting from tomorrow

  while (runner.getTime() <= endDate.getTime()) {
    const runnerDateStr = getLocalDateString(runner);
    if (!holidayDateSet.has(runnerDateStr)) {
      for (const slot of courseSlots) {
        if (isSlotActiveOnDate(slot, runner, undefined, overrides)) {
          count++;
        }
      }
    }
    runner.setDate(runner.getDate() + 1);
  }

  return count;
}

export function calculateAttendance(
  course: Course,
  collegeMinRequirement: number = 75,
  personalGoalPercentage?: number,
  remainingClasses?: number,
  classesEndDate?: string
): AttendanceAnalysis {
  const total = (course.totalClasses || 0) + (course.baselineClassesHeld || 0);
  const attended = (course.attendedClasses || 0) + (course.baselineAttendedClasses || 0);

  // Use course-specific goal if explicitly customized and higher than college minimum; otherwise inherits student's personal target
  const targetGoal = personalGoalPercentage !== undefined ? personalGoalPercentage : collegeMinRequirement;
  const effectivePersonalGoal = (course.attendanceGoal && course.attendanceGoal > collegeMinRequirement)
    ? course.attendanceGoal
    : Math.max(targetGoal, collegeMinRequirement);
  const collegeTarget = collegeMinRequirement / 100;
  const personalTarget = effectivePersonalGoal / 100;

  if (total === 0) {
    return {
      percentage: 100,
      isCollegeSafe: true,
      isPersonalGoalMet: true,
      statusText: 'No classes held yet',
      badgeColor: 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30',
      collegeSafeBunks: 0,
      personalGoalSafeBunks: 0,
      classesNeededForCollege: 0,
      classesNeededForPersonalGoal: 0,
      effectivePersonalGoal,
      collegeMinRequirement,
      remainingClasses: remainingClasses || 0,
      termCollegeSafeBunks: remainingClasses || 0,
      termPersonalSafeBunks: remainingClasses || 0,
      isDebarmentInevitable: false,
      isPersonalGoalUnreachable: false,
      maxPossiblePercentage: 100,
      severityLevel: 'optimal',
    };
  }

  const currentRatio = attended / total;
  const percentage = Math.round((attended / total) * 1000) / 10; // e.g. 88.5%

  const isCollegeSafe = currentRatio >= collegeTarget;
  const isPersonalGoalMet = currentRatio >= personalTarget;

  // College Bunk Margins & Needed
  const collegeSafeBunks = isCollegeSafe ? Math.max(0, Math.floor(attended / collegeTarget - total)) : 0;
  let classesNeededForCollege = 0;
  if (!isCollegeSafe) {
    if (collegeTarget >= 1.0) {
      classesNeededForCollege = 999;
    } else {
      classesNeededForCollege = Math.max(1, Math.ceil((collegeTarget * total - attended) / (1 - collegeTarget)));
    }
  }

  // Personal Goal Bunk Margins & Needed
  const personalGoalSafeBunks = isPersonalGoalMet
    ? Math.max(0, Math.floor(attended / personalTarget - total))
    : 0;
  let classesNeededForPersonalGoal = 0;
  if (!isPersonalGoalMet) {
    if (personalTarget >= 1.0) {
      classesNeededForPersonalGoal = 999;
    } else {
      classesNeededForPersonalGoal = Math.max(1, Math.ceil((personalTarget * total - attended) / (1 - personalTarget)));
    }
  }

  // Term-End Projection Calculations (if remainingClasses is provided)
  const hasRemaining = typeof remainingClasses === 'number' && remainingClasses > 0;
  let termCollegeSafeBunks: number | undefined = undefined;
  let termPersonalSafeBunks: number | undefined = undefined;
  let isDebarmentInevitable = false;
  let isPersonalGoalUnreachable = false;
  let maxPossiblePercentage: number | undefined = undefined;
  let collegeProjectionSummary: string | undefined = undefined;
  let goalProjectionSummary: string | undefined = undefined;
  let projectionSummary: string | undefined = undefined;

  if (hasRemaining) {
    const finalTotal = total + remainingClasses!;
    const maxPossibleAttended = attended + remainingClasses!;
    maxPossiblePercentage = Math.round((maxPossibleAttended / finalTotal) * 1000) / 10;

    // Max missable out of remaining classes such that (attended + remaining - missable) / finalTotal >= collegeTarget
    const rawCollegeMissable = Math.floor(attended + remainingClasses! - finalTotal * collegeTarget);
    termCollegeSafeBunks = Math.max(0, Math.min(remainingClasses!, rawCollegeMissable));

    const rawPersonalMissable = Math.floor(attended + remainingClasses! - finalTotal * personalTarget);
    termPersonalSafeBunks = Math.max(0, Math.min(remainingClasses!, rawPersonalMissable));

    // Feasibility Check: If below minimum and needed classes exceed remaining lectures
    if (!isCollegeSafe && classesNeededForCollege > remainingClasses!) {
      isDebarmentInevitable = true;
    }
    // Check if even attending 100% of remaining classes fails college minimum
    if ((maxPossibleAttended / finalTotal) < collegeTarget) {
      isDebarmentInevitable = true;
    }

    // Personal Goal Feasibility Check:
    if (classesNeededForPersonalGoal > remainingClasses! || (maxPossibleAttended / finalTotal) < personalTarget) {
      isPersonalGoalUnreachable = true;
    }

    // College Projection Summary (Tier 1: Debarment / Institutional Threshold)
    if (isDebarmentInevitable) {
      collegeProjectionSummary = `🚨 Debarment Risk: Need ${classesNeededForCollege} classes, but only ${remainingClasses} remain before teaching ends (${classesEndDate || 'term end'}). OD / Medical duty required!`;
    } else if (isCollegeSafe) {
      collegeProjectionSummary = `🛡️ College Safe: ${remainingClasses} lectures remain until ${classesEndDate || 'teaching ends'}. You can miss up to ${termCollegeSafeBunks} to stay above ${collegeMinRequirement}%.`;
    } else {
      collegeProjectionSummary = `⚠️ College Shortage: ${remainingClasses} lectures remain until ${classesEndDate || 'teaching ends'}. Must attend at least ${classesNeededForCollege} of them to reach ${collegeMinRequirement}%.`;
    }

    // Goal Projection Summary (Tier 2: Personal Goal Trajectory - less severe advisory)
    if (isPersonalGoalUnreachable) {
      goalProjectionSummary = `🎯 Goal Advisory: Max achievable is ${maxPossiblePercentage}% (target: ${effectivePersonalGoal}%) before ${classesEndDate || 'teaching ends'}.`;
    } else if (!isPersonalGoalMet) {
      goalProjectionSummary = `🎯 Goal Target: Must attend at least ${classesNeededForPersonalGoal} of ${remainingClasses} remaining classes to finish above ${effectivePersonalGoal}%.`;
    } else {
      goalProjectionSummary = `🎯 Goal Buffer: Can miss up to ${termPersonalSafeBunks} classes while keeping final attendance above ${effectivePersonalGoal}%.`;
    }

    projectionSummary = `${collegeProjectionSummary} ${goalProjectionSummary}`;
  }

  // Determine Severity Level, Badge Color, and Primary Status Text
  let severityLevel: AttendanceSeverity = 'optimal';
  let statusText = '';
  let badgeColor = '';

  if (isDebarmentInevitable) {
    severityLevel = 'debarment_risk';
    statusText = `Debarment Risk! Need ${classesNeededForCollege} classes, only ${remainingClasses} remaining before ${classesEndDate || 'term end'}`;
    badgeColor = 'text-rose-300 bg-rose-950/60 border-rose-500/50 shadow-rose-900/20';
  } else if (!isCollegeSafe) {
    severityLevel = 'college_warning';
    statusText = classesNeededForCollege >= 999
      ? `College Warning! Cannot reach 100% minimum requirement after missing classes`
      : `College Warning! Must attend next ${classesNeededForCollege} class${classesNeededForCollege > 1 ? 'es' : ''} to hit ${collegeMinRequirement}% minimum`;
    badgeColor = 'text-rose-400 bg-rose-950/40 border-rose-500/30';
  } else if (isPersonalGoalUnreachable) {
    severityLevel = 'goal_unreachable';
    statusText = `Goal Alert: Max reachable is ${maxPossiblePercentage}% (target: ${effectivePersonalGoal}%) before ${classesEndDate || 'term end'}`;
    badgeColor = 'text-amber-300 bg-amber-950/50 border-amber-500/40';
  } else if (!isPersonalGoalMet) {
    severityLevel = 'goal_warning';
    statusText = classesNeededForPersonalGoal >= 999
      ? `Above College Min (${collegeMinRequirement}%), but 100% goal is mathematically impossible once a class is missed`
      : `Above College Min (${collegeMinRequirement}%), but need ${classesNeededForPersonalGoal} class${classesNeededForPersonalGoal > 1 ? 'es' : ''} to reach ${effectivePersonalGoal}% goal`;
    badgeColor = 'text-amber-400 bg-amber-950/30 border-amber-500/20';
  } else {
    severityLevel = 'optimal';
    statusText = personalGoalSafeBunks > 0
      ? `On Track! You can miss ${personalGoalSafeBunks} class${personalGoalSafeBunks > 1 ? 'es' : ''} to stay above ${effectivePersonalGoal}%`
      : `Meeting your ${effectivePersonalGoal}% goal! Attend next class`;
    badgeColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30';
  }

  return {
    percentage,
    isCollegeSafe,
    isPersonalGoalMet,
    statusText,
    badgeColor,
    collegeSafeBunks,
    personalGoalSafeBunks,
    classesNeededForCollege,
    classesNeededForPersonalGoal,
    effectivePersonalGoal,
    collegeMinRequirement,
    remainingClasses,
    termCollegeSafeBunks,
    termPersonalSafeBunks,
    isDebarmentInevitable,
    isPersonalGoalUnreachable,
    maxPossiblePercentage,
    severityLevel,
    projectionSummary,
    collegeProjectionSummary,
    goalProjectionSummary,
  };
}

/**
 * Checks if a candidate time slot conflicts with existing time slots on the same day
 */
export function checkSlotOverlap(
  existingSlots: TimeSlot[],
  candidate: { day: DayOfWeek; startTime: string; endTime: string; id?: string }
): TimeSlot | null {
  const candStart = parseTimeToMinutes(candidate.startTime);
  const candEnd = parseTimeToMinutes(candidate.endTime);
  if (candEnd <= candStart) return null;

  for (const slot of existingSlots) {
    if (candidate.id && slot.id === candidate.id) continue;
    if (slot.day !== candidate.day) continue;
    const slotStart = parseTimeToMinutes(slot.startTime);
    const slotEnd = parseTimeToMinutes(slot.endTime);
    // Overlap condition: startA < endB && startB < endA
    if (candStart < slotEnd && slotStart < candEnd) {
      return slot;
    }
  }
  return null;
}
