import { DayOfWeek, TimeSlot, Course, AcademicHoliday } from '../types';

export const DAYS_ORDER: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

export function getTodayDayName(): DayOfWeek {
  const dayIndex = new Date().getDay(); // 0 is Sunday, 1 is Monday...
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
  const dateStr = targetDate.toISOString().split('T')[0];
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
}

/**
 * Determines whether a time slot takes place on a given calendar date,
 * respecting:
 * 1. One-off makeup/extra sessions (specificDate must match targetDate)
 * 2. Weekly vs Odd-week vs Even-week recurrence (based on week index from semesterStartDate)
 */
export function isSlotActiveOnDate(
  slot: TimeSlot,
  targetDate: Date,
  semesterStartDate?: string
): boolean {
  const targetDateStr = targetDate.toISOString().split('T')[0];

  // 1. One-Off Makeup Class
  if (slot.isOneOff) {
    return slot.specificDate === targetDateStr;
  }

  // If slot has a specific date but is not marked one-off, check if it matches
  if (slot.specificDate && slot.specificDate !== targetDateStr) {
    return false;
  }

  // 2. Day of Week Check
  const dayName = targetDate.toLocaleDateString('en-US', { weekday: 'long' }) as DayOfWeek;
  if (slot.day !== dayName) return false;

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
  holidays?: AcademicHoliday[]
): CurrentClassStatus {
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

  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  // Filter slots for today respecting one-offs and odd/even week recurrence
  const todaySlots = slots
    .filter((s) => isSlotActiveOnDate(s, currentTime, semesterStartDate))
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
  };
}

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
}

export function calculateAttendance(
  course: Course,
  collegeMinRequirement: number = 75,
  personalGoalPercentage?: number
): AttendanceAnalysis {
  const total = (course.totalClasses || 0) + (course.baselineClassesHeld || 0);
  const attended = (course.attendedClasses || 0) + (course.baselineAttendedClasses || 0);

  // Use course-specific goal if defined, otherwise personal goal (defaulting to college requirement if not set)
  const targetGoal = personalGoalPercentage !== undefined ? personalGoalPercentage : collegeMinRequirement;
  const effectivePersonalGoal = course.attendanceGoal || Math.max(targetGoal, collegeMinRequirement);
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

  let statusText = '';
  let badgeColor = '';

  if (isPersonalGoalMet) {
    statusText = personalGoalSafeBunks > 0
      ? `On Track! You can miss ${personalGoalSafeBunks} class${personalGoalSafeBunks > 1 ? 'es' : ''} to stay above ${effectivePersonalGoal}%`
      : `Meeting your ${effectivePersonalGoal}% goal! Attend next class`;
    badgeColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-500/30';
  } else if (isCollegeSafe) {
    statusText = classesNeededForPersonalGoal >= 999
      ? `Above College Min (${collegeMinRequirement}%), but 100% goal is mathematically impossible once a class is missed`
      : `Above College Min (${collegeMinRequirement}%), but need ${classesNeededForPersonalGoal} class${classesNeededForPersonalGoal > 1 ? 'es' : ''} to reach ${effectivePersonalGoal}% goal`;
    badgeColor = 'text-amber-400 bg-amber-950/40 border-amber-500/30';
  } else {
    statusText = classesNeededForCollege >= 999
      ? `College Warning! Cannot reach 100% minimum requirement after missing classes`
      : `College Warning! Must attend next ${classesNeededForCollege} class${classesNeededForCollege > 1 ? 'es' : ''} to hit ${collegeMinRequirement}% minimum`;
    badgeColor = 'text-rose-400 bg-rose-950/40 border-rose-500/30';
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
