import { DayOfWeek, TimeSlot, Course } from '../types';

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

export interface CurrentClassStatus {
  currentSlot: TimeSlot | null;
  currentCourse: Course | null;
  nextSlot: TimeSlot | null;
  nextCourse: Course | null;
  minutesRemaining: number;
  progressPercent: number;
  timeUntilNext: number; // Minutes until next class starts
}

export function getCurrentAndNextClass(
  slots: TimeSlot[],
  courses: Course[],
  currentTime: Date = new Date()
): CurrentClassStatus {
  const today = getTodayDayName();
  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  // Filter slots for today and sort by start time
  const todaySlots = slots
    .filter((s) => s.day === today)
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
