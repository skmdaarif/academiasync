import { UserAccount, StudentData, Course, TimeSlot, Task, AttendanceStatus } from '../types';

const API_BASE = '/api';

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
}

export async function apiRegister(payload: RegisterPayload): Promise<{ success: boolean; error?: string; user?: UserAccount; data?: StudentData }> {
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || 'Registration failed' };
    }
    return json;
  } catch (err: any) {
    return { success: false, error: 'Database connection failed. Please ensure backend is running.' };
  }
}

export async function apiLogin(email: string, password: string): Promise<{ success: boolean; error?: string; user?: UserAccount; data?: StudentData }> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json();
    if (!res.ok) {
      return { success: false, error: json.error || 'Login failed' };
    }
    return json;
  } catch (err: any) {
    return { success: false, error: 'Database connection failed. Please ensure backend is running.' };
  }
}

export async function apiFetchStudentData(userId: string): Promise<StudentData> {
  const res = await fetch(`${API_BASE}/data/${userId}`);
  if (!res.ok) throw new Error('Failed to fetch student data');
  return res.json();
}

export async function apiAddCourse(course: Omit<Course, 'id' | 'totalClasses' | 'attendedClasses'>): Promise<Course> {
  const res = await fetch(`${API_BASE}/courses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(course),
  });
  if (!res.ok) throw new Error('Failed to add course');
  return res.json();
}

export async function apiUpdateCourse(course: Course): Promise<Course> {
  const res = await fetch(`${API_BASE}/courses/${course.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(course),
  });
  if (!res.ok) throw new Error('Failed to update course');
  return res.json();
}

export async function apiDeleteCourse(courseId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/courses/${courseId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete course');
}

export async function apiAddSlot(slot: Omit<TimeSlot, 'id'>): Promise<TimeSlot> {
  const res = await fetch(`${API_BASE}/slots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slot),
  });
  if (!res.ok) throw new Error('Failed to add slot');
  return res.json();
}

export async function apiDeleteSlot(slotId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/slots/${slotId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete slot');
}

export async function apiAddTask(task: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Failed to add task');
  return res.json();
}

export async function apiUpdateTask(task: Task): Promise<Task> {
  const res = await fetch(`${API_BASE}/tasks/${task.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error('Failed to update task');
  return res.json();
}

export async function apiDeleteTask(taskId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/tasks/${taskId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete task');
}

export async function apiLogAttendance(userId: string, courseId: string, status: AttendanceStatus): Promise<{ record: any; updatedCourse: any }> {
  const res = await fetch(`${API_BASE}/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, courseId, status }),
  });
  if (!res.ok) throw new Error('Failed to log attendance');
  return res.json();
}

export async function apiUpdateProfile(user: UserAccount): Promise<UserAccount> {
  const res = await fetch(`${API_BASE}/users/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  });
  if (!res.ok) throw new Error('Failed to update profile');
  return res.json();
}

export async function apiWipeData(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/data/wipe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error('Failed to wipe data');
}
