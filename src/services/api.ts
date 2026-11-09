import { UserAccount, StudentData, Course, TimeSlot, Task, AttendanceStatus, AttendanceRecord } from '../types';

const API_BASE = '/api';
const TOKEN_KEY = 'academiasync_auth_token';
const LOCAL_STORAGE_DATA_PREFIX = 'academiasync_local_data_';
const LOCAL_USERS_KEY = 'academiasync_local_users_v2';

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ----------------------------------------------------------------------------
// Local Storage Fallback Engine
// ----------------------------------------------------------------------------
export function getLocalUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalUser(user: UserAccount) {
  try {
    const users = getLocalUsers().filter((u) => u.id !== user.id && u.email !== user.email);
    users.push(user);
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch {
    // Ignore
  }
}

export function getLocalStudentData(userId: string): StudentData {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_DATA_PREFIX}${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore
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

export function saveLocalStudentData(userId: string, data: StudentData) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_DATA_PREFIX}${userId}`, JSON.stringify(data));
  } catch {
    // Ignore
  }
}

// ----------------------------------------------------------------------------
// API Endpoints with Automatic Local Fallback
// ----------------------------------------------------------------------------

export async function apiCheckHealth(): Promise<{ isOnline: boolean; mode: 'postgres' | 'local'; message?: string }> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return { isOnline: false, mode: 'local' };
    const json = await res.json();
    return { isOnline: true, mode: json.mode || 'local', message: json.message };
  } catch {
    return { isOnline: false, mode: 'local' };
  }
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  country: string;
  collegeName: string;
  branch: string;
  degreeType: string;
  semester: string;
  targetAttendance: number;
  staySignedIn?: boolean;
}

export async function apiRegister(payload: RegisterPayload): Promise<{ success: boolean; error?: string; token?: string; user?: UserAccount; data?: StudentData; mode: 'postgres' | 'local' }> {
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      if (json.token) setAuthToken(json.token);
      return { ...json, mode: 'postgres' };
    }
    if (res.status === 409) {
      return { success: false, error: json.error, mode: 'postgres' };
    }
  } catch {
    // Network or server down: fallback to local storage
  }

  // Local Storage Account Creation Fallback
  const localId = `local_${Date.now()}`;
  const localUser: UserAccount = {
    id: localId,
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    country: payload.country || 'India',
    collegeName: payload.collegeName || 'University',
    branch: payload.branch || 'Computer Science',
    degreeType: payload.degreeType || 'B.Tech / B.E.',
    semester: payload.semester || 'Semester 1',
    totalSemesters: 8,
    collegeMinAttendance: payload.targetAttendance || 75,
    personalGoalAttendance: Math.max(85, payload.targetAttendance || 75),
    targetAttendance: payload.targetAttendance || 75,
    theme: 'dark-slate',
    staySignedIn: payload.staySignedIn ?? true,
    storageMode: 'local',
  };

  const blankData = getLocalStudentData(localId);
  saveLocalUser(localUser);
  saveLocalStudentData(localId, blankData);

  return {
    success: true,
    user: localUser,
    data: blankData,
    mode: 'local',
  };
}

export async function apiLogin(email: string, password: string, staySignedIn?: boolean): Promise<{ success: boolean; error?: string; token?: string; user?: UserAccount; data?: StudentData; mode: 'postgres' | 'local' }> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      if (json.token) setAuthToken(json.token);
      return { ...json, mode: 'postgres' };
    }
    if (res.status === 401 || res.status === 404) {
      return { success: false, error: json.error, mode: 'postgres' };
    }
  } catch {
    // Network or server down: check local storage
  }

  // Check local storage accounts
  const normalized = email.trim().toLowerCase();
  const localUsers = getLocalUsers();
  const matched = localUsers.find((u) => u.email === normalized);
  if (matched) {
    matched.staySignedIn = staySignedIn ?? true;
    const localData = getLocalStudentData(matched.id);
    return {
      success: true,
      user: matched,
      data: localData,
      mode: 'local',
    };
  }

  return {
    success: false,
    error: 'Account not found. Please create an account or try Demo Mode.',
    mode: 'local',
  };
}

export async function apiFetchStudentData(userId: string): Promise<StudentData> {
  try {
    const res = await fetch(`${API_BASE}/data/${userId}`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }
  return getLocalStudentData(userId);
}

export async function apiAddCourse(course: Omit<Course, 'id' | 'totalClasses' | 'attendedClasses'>): Promise<Course> {
  try {
    const res = await fetch(`${API_BASE}/courses`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(course),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }

  const userId = course.userId || 'local_user';
  const newCourse: Course = {
    ...course,
    id: `c_${Date.now()}`,
    totalClasses: 0,
    attendedClasses: 0,
  };
  const data = getLocalStudentData(userId);
  data.courses.push(newCourse);
  saveLocalStudentData(userId, data);
  return newCourse;
}

export async function apiUpdateCourse(course: Course): Promise<Course> {
  try {
    const res = await fetch(`${API_BASE}/courses/${course.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(course),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }

  const userId = course.userId || 'local_user';
  const data = getLocalStudentData(userId);
  data.courses = data.courses.map((c) => (c.id === course.id ? course : c));
  saveLocalStudentData(userId, data);
  return course;
}

export async function apiDeleteCourse(courseId: string, userId: string = 'local_user'): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/courses/${courseId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) return;
  } catch {
    // Fallback to local storage
  }

  const data = getLocalStudentData(userId);
  data.courses = data.courses.filter((c) => c.id !== courseId);
  data.timeSlots = data.timeSlots.filter((s) => s.courseId !== courseId);
  data.attendanceRecords = data.attendanceRecords.filter((a) => a.courseId !== courseId);
  saveLocalStudentData(userId, data);
}

export async function apiAddSlot(slot: Omit<TimeSlot, 'id'>): Promise<TimeSlot> {
  try {
    const res = await fetch(`${API_BASE}/slots`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(slot),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }

  const userId = slot.userId || 'local_user';
  const newSlot: TimeSlot = { ...slot, id: `s_${Date.now()}` };
  const data = getLocalStudentData(userId);
  data.timeSlots.push(newSlot);
  saveLocalStudentData(userId, data);
  return newSlot;
}

export async function apiUpdateSlot(slot: TimeSlot): Promise<TimeSlot> {
  try {
    const res = await fetch(`${API_BASE}/slots/${slot.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(slot),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }

  const userId = slot.userId || 'local_user';
  const data = getLocalStudentData(userId);
  data.timeSlots = data.timeSlots.map((s) => (s.id === slot.id ? slot : s));
  saveLocalStudentData(userId, data);
  return slot;
}

export async function apiDeleteSlot(slotId: string, userId: string = 'local_user'): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/slots/${slotId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) return;
  } catch {
    // Fallback to local storage
  }

  const data = getLocalStudentData(userId);
  data.timeSlots = data.timeSlots.filter((s) => s.id !== slotId);
  saveLocalStudentData(userId, data);
}

export async function apiAddTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
  try {
    const res = await fetch(`${API_BASE}/tasks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(task),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }

  const userId = task.userId || 'local_user';
  const newTask: Task = {
    ...task,
    id: `t_${Date.now()}`,
    createdAt: new Date().toISOString().split('T')[0],
  };
  const data = getLocalStudentData(userId);
  data.tasks.unshift(newTask);
  saveLocalStudentData(userId, data);
  return newTask;
}

export async function apiUpdateTask(task: Task): Promise<Task> {
  try {
    const res = await fetch(`${API_BASE}/tasks/${task.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(task),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }

  const userId = task.userId || 'local_user';
  const data = getLocalStudentData(userId);
  data.tasks = data.tasks.map((t) => (t.id === task.id ? task : t));
  saveLocalStudentData(userId, data);
  return task;
}

export async function apiDeleteTask(taskId: string, userId: string = 'local_user'): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) return;
  } catch {
    // Fallback to local storage
  }

  const data = getLocalStudentData(userId);
  data.tasks = data.tasks.filter((t) => t.id !== taskId);
  saveLocalStudentData(userId, data);
}

export async function apiLogAttendance(userId: string, courseId: string, status: AttendanceStatus): Promise<{ record: AttendanceRecord; updatedCourse: Course }> {
  try {
    const res = await fetch(`${API_BASE}/attendance`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, courseId, status }),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }

  const data = getLocalStudentData(userId);
  const course = data.courses.find((c) => c.id === courseId);
  const nowStr = new Date().toISOString().split('T')[0];
  const record: AttendanceRecord = {
    id: `att_${Date.now()}`,
    courseId,
    date: nowStr,
    status,
  };
  data.attendanceRecords.unshift(record);

  if (course) {
    course.totalClasses = (course.totalClasses || 0) + 1;
    if (status === 'present') {
      course.attendedClasses = (course.attendedClasses || 0) + 1;
    }
  }

  saveLocalStudentData(userId, data);
  return {
    record,
    updatedCourse: course || {
      id: courseId,
      code: 'COURSE',
      name: 'Course',
      color: '#3b82f6',
      totalClasses: 1,
      attendedClasses: status === 'present' ? 1 : 0,
    },
  };
}

export async function apiUndoAttendance(userId: string, courseId: string): Promise<{ deletedRecordId: string | null; updatedCourse: Course }> {
  try {
    const res = await fetch(`${API_BASE}/attendance/undo`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, courseId }),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }

  const data = getLocalStudentData(userId);
  const recordIndex = data.attendanceRecords.findIndex((r) => r.courseId === courseId);
  let deletedRecordId: string | null = null;
  let wasPresent = false;

  if (recordIndex !== -1) {
    deletedRecordId = data.attendanceRecords[recordIndex].id;
    wasPresent = data.attendanceRecords[recordIndex].status === 'present';
    data.attendanceRecords.splice(recordIndex, 1);
  } else {
    wasPresent = true;
  }

  const course = data.courses.find((c) => c.id === courseId);
  if (course) {
    course.totalClasses = Math.max(0, (course.totalClasses || 0) - 1);
    if (wasPresent) {
      course.attendedClasses = Math.max(0, (course.attendedClasses || 0) - 1);
    }
  }

  saveLocalStudentData(userId, data);
  return {
    deletedRecordId,
    updatedCourse: course || {
      id: courseId,
      code: 'COURSE',
      name: 'Course',
      color: '#3b82f6',
      totalClasses: 0,
      attendedClasses: 0,
    },
  };
}

export async function apiUpdateProfile(user: UserAccount): Promise<UserAccount> {
  try {
    const res = await fetch(`${API_BASE}/users/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(user),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }

  saveLocalUser(user);
  return user;
}

export async function apiWipeData(userId: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/data/wipe`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId }),
    });
    if (res.ok) return;
  } catch {
    // Fallback to local storage
  }

  saveLocalStudentData(userId, {
    courses: [],
    timeSlots: [],
    tasks: [],
    attendanceRecords: [],
    theme: 'dark-slate',
    activeView: 'dashboard',
  });
}

export async function apiRestoreStudentData(userId: string, data: StudentData): Promise<{ success: boolean; data: StudentData }> {
  try {
    const res = await fetch(`${API_BASE}/data/restore`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, data }),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }

  saveLocalStudentData(userId, data);
  return { success: true, data };
}

export async function apiDeleteAccount(userId: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      // Also clean up any mirrored local storage for this user
      try {
        const users = getLocalUsers().filter((u) => u.id !== userId);
        localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
        localStorage.removeItem(`${LOCAL_STORAGE_DATA_PREFIX}${userId}`);
      } catch {
        // Ignore
      }
      setAuthToken(null);
      return;
    }
  } catch {
    // Fallback to local storage
  }

  const users = getLocalUsers().filter((u) => u.id !== userId);
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  localStorage.removeItem(`${LOCAL_STORAGE_DATA_PREFIX}${userId}`);
  setAuthToken(null);
}

