import { UserAccount, StudentData } from '../types';

const USERS_STORAGE_KEY = 'academiasync_registered_users_v3';
const CURRENT_SESSION_KEY = 'academiasync_active_session_v3';
const DATA_STORAGE_PREFIX = 'academiasync_user_data_';

export function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + password.length;
}

export function getRegisteredUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load registered users:', e);
  }
  return [];
}

export function saveRegisteredUsers(users: UserAccount[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save registered users:', e);
  }
}

export function getCurrentUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(CURRENT_SESSION_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to get current user:', e);
  }
  return null;
}

export function setCurrentUser(user: UserAccount | null): void {
  try {
    if (user) {
      localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  } catch (e) {
    console.error('Failed to set current user:', e);
  }
}

export interface SignUpParams {
  name: string;
  email: string;
  password: string;
  country?: string;
  collegeName: string;
  branch: string;
  degreeType?: string;
  semester: string;
  targetAttendance?: number;
}

export function registerStudent(params: SignUpParams): { success: boolean; error?: string; user?: UserAccount } {
  const users = getRegisteredUsers();
  const normalizedEmail = params.email.trim().toLowerCase();

  if (!normalizedEmail || !params.password) {
    return { success: false, error: 'Email and password are required.' };
  }

  const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    return { success: false, error: 'An account with this email address already exists. Please sign in.' };
  }

  const minAtt = params.targetAttendance || 75;
  const newUser: UserAccount = {
    id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: normalizedEmail,
    passwordHash: hashPassword(params.password),
    name: params.name.trim(),
    country: params.country || 'India',
    collegeName: params.collegeName.trim() || 'College of Engineering',
    branch: params.branch.trim() || 'Computer Science',
    degreeType: params.degreeType || 'B.Tech (4 Years - 8 Semesters)',
    semester: params.semester.trim() || 'Semester 1',
    totalSemesters: 8,
    collegeMinAttendance: minAtt,
    personalGoalAttendance: minAtt,
    targetAttendance: minAtt,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveRegisteredUsers(users);

  const blankData: StudentData = {
    courses: [],
    timeSlots: [],
    tasks: [],
    attendanceRecords: [],
    theme: 'dark-slate',
    activeView: 'dashboard',
  };
  saveStudentData(newUser.id, blankData);

  setCurrentUser(newUser);

  return { success: true, user: newUser };
}

export function loginStudent(email: string, password: string): { success: boolean; error?: string; user?: UserAccount } {
  const users = getRegisteredUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!user) {
    return { success: false, error: 'No student account found with this email. Please create an account.' };
  }

  if (user.passwordHash !== hashPassword(password)) {
    return { success: false, error: 'Incorrect password. Please try again.' };
  }

  setCurrentUser(user);
  return { success: true, user };
}

export function logoutStudent(): void {
  setCurrentUser(null);
}

export function loadStudentData(userId: string): StudentData {
  try {
    const raw = localStorage.getItem(DATA_STORAGE_PREFIX + userId);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        courses: parsed.courses || [],
        timeSlots: parsed.timeSlots || [],
        tasks: parsed.tasks || [],
        attendanceRecords: parsed.attendanceRecords || [],
        theme: parsed.theme || 'dark-slate',
        activeView: parsed.activeView || 'dashboard',
      };
    }
  } catch (e) {
    console.error('Failed to load student data:', e);
  }

  return {
    courses: [],
    timeSlots: [],
    tasks: [],
    attendanceRecords: [],
    theme: 'dark-slate',
    activeView: 'dashboard',
  };
}

export function saveStudentData(userId: string, data: StudentData): void {
  try {
    localStorage.setItem(DATA_STORAGE_PREFIX + userId, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save student data:', e);
  }
}
