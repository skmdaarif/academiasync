import { UserAccount, StudentData, Course, TimeSlot, Task, AttendanceStatus, AttendanceRecord, AcademicSemester, AdmissionType, Exam } from '../types';

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
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.exams) parsed.exams = [];
      return parsed;
    }
  } catch {
    // Ignore
  }
  return {
    courses: [],
    timeSlots: [],
    tasks: [],
    attendanceRecords: [],
    semesters: [],
    exams: [],
    activeSemesterNumber: 1,
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

export async function apiCheckHealth(): Promise<{ isOnline: boolean; mode: 'sqlite' | 'local'; message?: string }> {
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
  admissionType?: AdmissionType;
  semesterStartDate?: string;
  backfilledSemesters?: AcademicSemester[];
}

export async function apiRegister(payload: RegisterPayload): Promise<{ success: boolean; error?: string; token?: string; user?: UserAccount; data?: StudentData; mode: 'sqlite' | 'local' }> {
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      if (json.token) setAuthToken(json.token);
      return { ...json, mode: 'sqlite' };
    }
    if (res.status === 409) {
      return { success: false, error: json.error, mode: 'sqlite' };
    }
  } catch {
    // Network or server down: fallback to local storage
  }

  // Local Storage Account Creation Fallback
  const localId = `local_${Date.now()}`;
  const parsedSem = parseInt(String(payload.semester).replace(/\D/g, ''), 10) || 1;
  const admissionType = payload.admissionType || (parsedSem > 1 ? 'continuing' : 'fresh');

  const localUser: UserAccount = {
    id: localId,
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    country: payload.country || 'India',
    collegeName: payload.collegeName || 'University',
    branch: payload.branch || 'Computer Science',
    degreeType: payload.degreeType || 'B.Tech / B.E.',
    semester: payload.semester || `Semester ${parsedSem}`,
    totalSemesters: 8,
    admissionType,
    activeSemesterNumber: parsedSem,
    semesterStartDate: payload.semesterStartDate,
    collegeMinAttendance: payload.targetAttendance || 75,
    personalGoalAttendance: Math.max(85, payload.targetAttendance || 75),
    targetAttendance: payload.targetAttendance || 75,
    theme: 'dark-slate',
    staySignedIn: payload.staySignedIn ?? true,
    storageMode: 'local',
  };

  const initialSemesters: AcademicSemester[] = [];
  if (Array.isArray(payload.backfilledSemesters) && payload.backfilledSemesters.length > 0) {
    initialSemesters.push(...payload.backfilledSemesters);
  }
  initialSemesters.push({
    id: `sem_${Date.now()}_${parsedSem}`,
    userId: localId,
    semesterNumber: parsedSem,
    title: payload.semester || `Semester ${parsedSem}`,
    status: 'active',
    creditsEarned: 0,
    startDate: new Date().toISOString().split('T')[0],
  });

  const blankData: StudentData = {
    ...getLocalStudentData(localId),
    semesters: initialSemesters,
    activeSemesterNumber: parsedSem,
  };

  saveLocalUser(localUser);
  saveLocalStudentData(localId, blankData);

  return {
    success: true,
    user: localUser,
    data: blankData,
    mode: 'local',
  };
}

export async function apiLogin(email: string, password: string, staySignedIn?: boolean): Promise<{ success: boolean; error?: string; token?: string; user?: UserAccount; data?: StudentData; mode: 'sqlite' | 'local' }> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      if (json.token) setAuthToken(json.token);
      return { ...json, mode: 'sqlite' };
    }
    if (res.status === 401 || res.status === 404) {
      return { success: false, error: json.error, mode: 'sqlite' };
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
  const data = getLocalStudentData(userId);
  const newCourse: Course = {
    ...course,
    id: `c_${Date.now()}`,
    semesterNumber: course.semesterNumber || data.activeSemesterNumber || 1,
    totalClasses: 0,
    attendedClasses: 0,
    baselineClassesHeld: course.baselineClassesHeld || 0,
    baselineAttendedClasses: course.baselineAttendedClasses || 0,
  };
  data.courses.push(newCourse);
  if (!data.exams) data.exams = [];
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
  if (!data.exams) data.exams = [];
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
  if (!data.exams) data.exams = [];
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
  const data = getLocalStudentData(userId);
  const newSlot: TimeSlot = {
    ...slot,
    id: `s_${Date.now()}`,
    semesterNumber: slot.semesterNumber || data.activeSemesterNumber || 1,
  };
  data.timeSlots.push(newSlot);
  if (!data.exams) data.exams = [];
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
  if (!data.exams) data.exams = [];
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
  if (!data.exams) data.exams = [];
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
  const data = getLocalStudentData(userId);
  const newTask: Task = {
    ...task,
    id: `t_${Date.now()}`,
    createdAt: new Date().toISOString().split('T')[0],
    semesterNumber: task.semesterNumber || data.activeSemesterNumber || 1,
  };
  data.tasks.unshift(newTask);
  if (!data.exams) data.exams = [];
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
  if (!data.exams) data.exams = [];
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
  if (!data.exams) data.exams = [];
  saveLocalStudentData(userId, data);
}

// ----------------------------------------------------------------------------
// Exam Operations
// ----------------------------------------------------------------------------

export async function apiGetExams(userId: string): Promise<Exam[]> {
  try {
    const res = await fetch(`${API_BASE}/exams/${userId}`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }

  const data = getLocalStudentData(userId);
  return data.exams || [];
}

export async function apiAddExam(exam: Omit<Exam, 'id' | 'createdAt'>): Promise<Exam> {
  try {
    const res = await fetch(`${API_BASE}/exams`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(exam),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }

  const userId = exam.userId || 'local_user';
  const data = getLocalStudentData(userId);
  if (!data.exams) data.exams = [];
  const newExam: Exam = {
    ...exam,
    id: `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  data.exams.push(newExam);
  if (!data.exams) data.exams = [];
  saveLocalStudentData(userId, data);
  return newExam;
}

export async function apiUpdateExam(exam: Exam): Promise<Exam> {
  try {
    const res = await fetch(`${API_BASE}/exams/${exam.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(exam),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }

  const userId = exam.userId || 'local_user';
  const data = getLocalStudentData(userId);
  if (!data.exams) data.exams = [];
  data.exams = data.exams.map((e) => (e.id === exam.id ? exam : e));
  if (!data.exams) data.exams = [];
  saveLocalStudentData(userId, data);
  return exam;
}

export async function apiDeleteExam(examId: string, userId: string = 'local_user'): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/exams/${examId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) return;
  } catch {
    // Fallback to local storage
  }

  const data = getLocalStudentData(userId);
  if (data.exams) {
    data.exams = data.exams.filter((e) => e.id !== examId);
    saveLocalStudentData(userId, data);
  }
}

export async function apiLogAttendance(
  userId: string, 
  courseId: string, 
  status: AttendanceStatus,
  date?: string,
  note?: string,
  semesterNumber?: number,
  documentRef?: string
): Promise<{ record: AttendanceRecord; updatedCourse: Course }> {
  try {
    const res = await fetch(`${API_BASE}/attendance`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, courseId, status, date, note, semesterNumber, documentRef }),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }

  const data = getLocalStudentData(userId);
  const course = data.courses.find((c) => c.id === courseId);
  const nowStr = date || new Date().toISOString().split('T')[0];
  const record: AttendanceRecord = {
    id: `att_${Date.now()}`,
    courseId,
    date: nowStr,
    status,
    note,
    documentRef,
    semesterNumber: semesterNumber || data.activeSemesterNumber || 1,
  };
  data.attendanceRecords.unshift(record);

  const isCounted = status === 'present' || status === 'absent';
  if (course && isCounted) {
    course.totalClasses = (course.totalClasses || 0) + 1;
    if (status === 'present') {
      course.attendedClasses = (course.attendedClasses || 0) + 1;
    }
  }

  if (!data.exams) data.exams = [];
  saveLocalStudentData(userId, data);
  return {
    record,
    updatedCourse: course || {
      id: courseId,
      code: 'COURSE',
      name: 'Course',
      color: '#3b82f6',
      totalClasses: isCounted ? 1 : 0,
      attendedClasses: status === 'present' ? 1 : 0,
    },
  };
}

export async function apiDeleteAttendanceRecord(
  userId: string,
  recordId: string
): Promise<{ deletedRecordId: string; updatedCourse?: Course }> {
  try {
    const res = await fetch(`${API_BASE}/attendance/${recordId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (res.ok) return await res.json();
  } catch {
    // Fallback to local storage
  }

  const data = getLocalStudentData(userId);
  const recordIndex = data.attendanceRecords.findIndex((r) => r.id === recordId);
  if (recordIndex === -1) {
    return { deletedRecordId: recordId };
  }

  const rec = data.attendanceRecords[recordIndex];
  data.attendanceRecords.splice(recordIndex, 1);

  const course = data.courses.find((c) => c.id === rec.courseId);
  if (course) {
    const isPresent = rec.status === 'present';
    const isCounted = rec.status === 'present' || rec.status === 'absent';
    if (isCounted) {
      course.totalClasses = Math.max(0, (course.totalClasses || 0) - 1);
    }
    if (isPresent) {
      course.attendedClasses = Math.max(0, (course.attendedClasses || 0) - 1);
    }
  }

  if (!data.exams) data.exams = [];
  saveLocalStudentData(userId, data);
  return { deletedRecordId: recordId, updatedCourse: course };
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
  let wasCounted = false;

  if (recordIndex !== -1) {
    const rec = data.attendanceRecords[recordIndex];
    deletedRecordId = rec.id;
    wasPresent = rec.status === 'present';
    wasCounted = rec.status === 'present' || rec.status === 'absent';
    data.attendanceRecords.splice(recordIndex, 1);
  } else {
    wasPresent = true;
    wasCounted = true;
  }

  const course = data.courses.find((c) => c.id === courseId);
  if (course) {
    if (wasCounted) {
      course.totalClasses = Math.max(0, (course.totalClasses || 0) - 1);
    }
    if (wasPresent) {
      course.attendedClasses = Math.max(0, (course.attendedClasses || 0) - 1);
    }
  }

  if (!data.exams) data.exams = [];
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

  if (!data.exams) data.exams = [];
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

// ----------------------------------------------------------------------------
// Academic Semesters & Vault API
// ----------------------------------------------------------------------------

export async function apiFetchSemesters(userId: string): Promise<AcademicSemester[]> {
  try {
    const res = await fetch(`${API_BASE}/semesters/${userId}`, {
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback to local storage
  }

  const localData = getLocalStudentData(userId);
  return localData.semesters || [];
}

export async function apiBackfillSemesters(
  userId: string,
  semesters: AcademicSemester[]
): Promise<{ success: boolean; semesters: AcademicSemester[] }> {
  try {
    const res = await fetch(`${API_BASE}/semesters/backfill`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, semesters }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback to local storage
  }

  const localData = getLocalStudentData(userId);
  const currentList = localData.semesters || [];

  for (const s of semesters) {
    const idx = currentList.findIndex((item) => item.semesterNumber === s.semesterNumber);
    if (idx !== -1) {
      currentList[idx] = { ...currentList[idx], ...s };
    } else {
      currentList.push({
        ...s,
        id: s.id || `sem_${Date.now()}_${s.semesterNumber}`,
        userId,
      });
    }
  }
  currentList.sort((a, b) => a.semesterNumber - b.semesterNumber);
  localData.semesters = currentList;
  saveLocalStudentData(userId, localData);

  return { success: true, semesters: currentList };
}

export async function apiPromoteSemester(
  userId: string,
  nextSemesterNumber: number,
  currentSemSummary: { finalAttendancePct?: number; creditsEarned: number; sgpa?: number; notes?: string }
): Promise<{ success: boolean; user?: UserAccount; data?: StudentData }> {
  try {
    const res = await fetch(`${API_BASE}/semesters/promote`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, nextSemesterNumber, currentSemSummary }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback to local storage
  }

  // Local storage promotion logic
  const localData = getLocalStudentData(userId);
  const localUsers = getLocalUsers();
  const userIdx = localUsers.findIndex((u) => u.id === userId);
  const currUser = userIdx !== -1 ? localUsers[userIdx] : null;

  const currSemNumber = currUser?.activeSemesterNumber || (nextSemesterNumber - 1);
  const today = new Date().toISOString().split('T')[0];

  const semesters = localData.semesters || [];
  const activeIdx = semesters.findIndex((s) => s.semesterNumber === currSemNumber);
  if (activeIdx !== -1) {
    semesters[activeIdx] = {
      ...semesters[activeIdx],
      status: 'archived',
      endDate: today,
      finalAttendancePct: currentSemSummary.finalAttendancePct,
      creditsEarned: currentSemSummary.creditsEarned,
      sgpa: currentSemSummary.sgpa,
      notes: currentSemSummary.notes,
    };
  } else {
    semesters.push({
      id: `sem_${Date.now()}_${currSemNumber}`,
      userId,
      semesterNumber: currSemNumber,
      title: `Semester ${currSemNumber}`,
      status: 'archived',
      endDate: today,
      finalAttendancePct: currentSemSummary.finalAttendancePct,
      creditsEarned: currentSemSummary.creditsEarned,
      sgpa: currentSemSummary.sgpa,
      notes: currentSemSummary.notes,
    });
  }

  const nextIdx = semesters.findIndex((s) => s.semesterNumber === nextSemesterNumber);
  if (nextIdx !== -1) {
    semesters[nextIdx].status = 'active';
    semesters[nextIdx].startDate = today;
  } else {
    semesters.push({
      id: `sem_${Date.now()}_${nextSemesterNumber}`,
      userId,
      semesterNumber: nextSemesterNumber,
      title: `Semester ${nextSemesterNumber}`,
      status: 'active',
      startDate: today,
      creditsEarned: 0,
    });
  }

  semesters.sort((a, b) => a.semesterNumber - b.semesterNumber);

  localData.semesters = semesters;
  localData.activeSemesterNumber = nextSemesterNumber;

  if (currUser) {
    currUser.activeSemesterNumber = nextSemesterNumber;
    currUser.semester = `Semester ${nextSemesterNumber}`;
    saveLocalUser(currUser);
  }
  saveLocalStudentData(userId, localData);

  return {
    success: true,
    user: currUser || undefined,
    data: localData,
  };
}

