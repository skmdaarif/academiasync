import { StudentData, UserAccount } from '../types';

export type AppState = StudentData;
export type UserProfile = UserAccount;

export function getBlankStudentData(): StudentData {
  return {
    courses: [],
    timeSlots: [],
    tasks: [],
    attendanceRecords: [],
    semesters: [],
    exams: [],
    holidays: [],
    scheduleOverrides: [],
    activeSemesterNumber: 1,
    theme: 'dark-slate',
    activeView: 'dashboard',
  };
}

export function exportStateAsJSON(data: StudentData, user?: UserAccount): string {
  return JSON.stringify({ user, data, exportedAt: new Date().toISOString() }, null, 2);
}

export function importStateFromJSON(jsonString: string): StudentData | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed.data && Array.isArray(parsed.data.courses)) {
      return {
        ...parsed.data,
        exams: parsed.data.exams || [],
        holidays: parsed.data.holidays || [],
        scheduleOverrides: parsed.data.scheduleOverrides || [],
        semesters: parsed.data.semesters || [],
      };
    }
    if (Array.isArray(parsed.courses)) {
      return {
        courses: parsed.courses,
        timeSlots: parsed.timeSlots || [],
        tasks: parsed.tasks || [],
        attendanceRecords: parsed.attendanceRecords || [],
        semesters: parsed.semesters || [],
        exams: parsed.exams || [],
        holidays: parsed.holidays || [],
        scheduleOverrides: parsed.scheduleOverrides || [],
        activeSemesterNumber: parsed.activeSemesterNumber || 1,
        theme: parsed.theme || 'dark-slate',
        activeView: 'dashboard',
      };
    }
  } catch (e) {
    console.error('Invalid JSON structure:', e);
  }
  return null;
}
