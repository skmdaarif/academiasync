import { StudentData, Course, TimeSlot, Task, UserAccount, ThemeKey } from '../types';

export type AppState = StudentData;
export type UserProfile = UserAccount;

export function getBlankStudentData(): StudentData {
  return {
    courses: [],
    timeSlots: [],
    tasks: [],
    attendanceRecords: [],
    semesters: [],
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
      return parsed.data;
    }
    if (Array.isArray(parsed.courses)) {
      return {
        courses: parsed.courses,
        timeSlots: parsed.timeSlots || [],
        tasks: parsed.tasks || [],
        attendanceRecords: parsed.attendanceRecords || [],
        theme: parsed.theme || 'dark-slate',
        activeView: 'dashboard',
      };
    }
  } catch (e) {
    console.error('Invalid JSON structure:', e);
  }
  return null;
}
