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
  marksheetRef?: string; // Link to official marksheet / grade card PDF or image
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
  studentBatch?: string; // e.g. "Batch A", "B1", "Section 2"
  admissionType?: AdmissionType;
  activeSemesterNumber?: number;
  semesterStartDate?: string; // e.g. "2026-08-01"
  collegeMinAttendance: number; // e.g. 75% set by University
  personalGoalAttendance: number; // e.g. 90% custom student target (>= collegeMinAttendance)
  targetAttendance?: number; // legacy alias for compatibility
  initialAttendancePct?: number; // Baseline attendance % if onboarded mid-semester
  excusedPolicy?: 'exemption' | 'credit'; // 'exemption' (default): excludes from total classes; 'credit': counts as attended
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
  baselineClassesHeld?: number; // Portal baseline prior to joining
  baselineAttendedClasses?: number; // Portal baseline attended
  syllabusUrl?: string; // Link to syllabus PDF or web document
  driveFolderLink?: string; // Google Drive / LMS folder link
  professorEmail?: string; // Faculty email for direct contact
  cabinRoom?: string; // Faculty office or cabin location
  semesterNumber?: number;
}

export type SlotRecurrence = 'all' | 'odd_weeks' | 'even_weeks';

export interface TimeSlot {
  id: string;
  userId?: string;
  courseId: string;
  day: DayOfWeek;
  startTime: string; // "09:00"
  endTime: string;   // "10:00"
  room?: string;
  type: SlotType;
  recurrence?: SlotRecurrence;
  isOneOff?: boolean;
  specificDate?: string; // YYYY-MM-DD
  batch?: string; // e.g. "B1", "B2"
  durationMultiplier?: number; // e.g. 2 for 2-hour lab, 3 for 3-hour lab
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
  submissionUrl?: string; // Link to LMS portal (Google Classroom, Canvas, Moodle, Teams)
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
  periodsCount?: number; // Count of periods credited/debited (e.g. 2 or 3 for multi-hour labs)
  note?: string;
  documentRef?: string; // Certificate / Proof Link / OD Token
  semesterNumber?: number;
}

export type ExamCategory = 'mtt' | 'ett' | 'ca' | 'viva' | 'quiz' | 'project' | 'backlog' | 'other';
export type ExamType = 'theory' | 'practical' | 'hybrid';

export interface SyllabusUnit {
  id: string;
  title: string;
  completed: boolean;
}

export interface Exam {
  id: string;
  userId?: string;
  courseId?: string;
  title: string;
  examCategory: ExamCategory;
  examType: ExamType;
  examDate: string; // YYYY-MM-DD
  startTime?: string; // "09:00"
  endTime?: string;   // "12:00"
  roomOrLab?: string;
  seatNumber?: string; // Desk / Seat / Row Number
  session?: 'morning' | 'afternoon';
  maxMarks?: number;
  marksObtained?: number;
  isResultAwaiting?: boolean; // Exam conducted, paper submitted, but marks pending declaration
  resultStatus?: 'declared' | 'awaiting' | 'upcoming';
  syllabusUnits?: SyllabusUnit[];
  semesterNumber?: number;
  notes?: string;
  createdAt?: string;
}

export interface AcademicHoliday {
  id: string;
  userId?: string;
  title: string; // e.g. "Diwali Vacation", "Mid-Term Recess", "Sports Fest"
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isOffDay?: boolean;
  notes?: string;
  semesterNumber?: number;
  createdAt?: string;
}

export interface ScheduleOverride {
  id: string;
  userId?: string;
  date: string; // YYYY-MM-DD
  runDaySchedule: DayOfWeek; // e.g. "Monday"
  reason?: string; // e.g. "Follow Monday Timetable on Saturday"
  createdAt?: string;
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
  exams?: Exam[];
  holidays?: AcademicHoliday[];
  scheduleOverrides?: ScheduleOverride[];
  activeSemesterNumber?: number;
  theme: ThemeKey;
  activeView: 'dashboard' | 'timetable' | 'tasks' | 'attendance' | 'exams';
}

export interface MidSemCatchupTask {
  title: string;
  courseId?: string;
  courseCode?: string;
  dueDate: string;
  dueTime?: string;
  priority?: TaskPriority;
  status: 'completed' | 'todo' | 'in-progress';
  submissionUrl?: string;
}

export interface MidSemCatchupExam {
  title: string;
  courseId?: string;
  courseCode?: string;
  examCategory: ExamCategory;
  examType?: ExamType;
  examDate: string;
  maxMarks?: number;
  marksObtained?: number;
  isResultAwaiting?: boolean;
  resultStatus?: 'declared' | 'awaiting' | 'upcoming';
  isCompleted?: boolean;
}

export interface MidSemCatchupData {
  attendancePct?: number;
  completedTasks: MidSemCatchupTask[];
  pendingTasks: MidSemCatchupTask[];
  conductedExams: MidSemCatchupExam[];
}
