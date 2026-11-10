export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type SlotType = 'Lecture' | 'Lab' | 'Tutorial' | 'Seminar' | 'Club / Activity';

export type AdmissionType = 'fresh' | 'lateral' | 'continuing';

export interface AcademicSemester {
  id: string;
  userId?: string;
  semesterNumber: number;
  title: string; // e.g. "Semester 1", "Semester 3"
  status: 'active' | 'archived' | 'backfilled';
  startDate?: string;
  endDate?: string;
  finalAttendancePct?: number;
  creditsEarned: number;
  sgpa?: number;
  notes?: string;
  createdAt?: string;
}

export interface UserAccount {
  id: string;
  email: string;
  passwordHash?: string;
  name: string;
  country: string;
  collegeName: string;
  branch: string;
  degreeType: string;
  semester: string;
  totalSemesters: number;
  rollNumber?: string; // University Roll Number or Student VID
  vid?: string; // Alias for student VID
  admissionType?: AdmissionType;
  activeSemesterNumber?: number;
  semesterStartDate?: string; // e.g. "2026-08-01"
  collegeMinAttendance: number; // e.g. 75% set by University
  personalGoalAttendance: number; // e.g. 90% custom student target (>= collegeMinAttendance)
  targetAttendance?: number; // legacy alias for compatibility
  theme?: ThemeKey;
  staySignedIn?: boolean;
  storageMode?: 'sqlite' | 'local' | 'postgres';
  createdAt?: string;
}

export interface Course {
  id: string;
  userId?: string;
  code: string; // e.g. "CS301"
  name: string; // e.g. "Database Management Systems"
  professor?: string;
  defaultRoom?: string;
  color: string; // Hex color
  credits?: number;
  attendanceGoal?: number; // Custom course-specific target
  totalClasses: number;
  attendedClasses: number;
  semesterNumber?: number;
}

export interface TimeSlot {
  id: string;
  userId?: string;
  courseId: string;
  day: DayOfWeek;
  startTime: string; // "09:00"
  endTime: string;   // "10:00"
  room?: string;
  type: SlotType;
  notes?: string;
  meetingLink?: string;
  semesterNumber?: number;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in-progress' | 'completed';
export type TaskCategory = 'assignment' | 'exam' | 'project' | 'quiz' | 'reading' | 'personal';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  userId?: string;
  title: string;
  description?: string;
  courseId?: string;
  dueDate: string;   // YYYY-MM-DD
  dueTime?: string;  // "23:59"
  priority: TaskPriority;
  status: TaskStatus;
  category: TaskCategory;
  subtasks?: SubTask[];
  semesterNumber?: number;
  createdAt?: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'cancelled' | 'holiday' | 'excused';

export interface AttendanceRecord {
  id: string;
  userId?: string;
  courseId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  slotId?: string;
  note?: string;
  semesterNumber?: number;
}

export type ThemeKey = 
  | 'dark-slate' 
  | 'cyberpunk' 
  | 'midnight-oled' 
  | 'emerald-forest' 
  | 'sunset-amber' 
  | 'light-minimal';

export interface StudentData {
  courses: Course[];
  timeSlots: TimeSlot[];
  tasks: Task[];
  attendanceRecords: AttendanceRecord[];
  semesters?: AcademicSemester[];
  activeSemesterNumber?: number;
  theme: ThemeKey;
  activeView: 'dashboard' | 'timetable' | 'tasks' | 'attendance' | 'exams';
}
