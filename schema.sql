-- ============================================================================
-- 🎓 AcademiaSync Database Schema (SQLite 3)
-- Embedded Relational Schema for College Timetable & Task Management
-- Zero-config file database located at ./data/academiasync.db
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- 1. USERS & PROFILES
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    country TEXT,
    college_name TEXT,
    branch TEXT,
    degree_type TEXT,
    semester TEXT,
    total_semesters INTEGER DEFAULT 8,
    semester_start_date TEXT,
    college_min_attendance REAL DEFAULT 75.0,
    personal_attendance_goal REAL DEFAULT 75.0,
    target_attendance_percentage REAL DEFAULT 75.0,
    theme_preference TEXT DEFAULT 'dark-slate',
    created_at TEXT DEFAULT (datetime('now'))
);

-- 2. COURSES / SUBJECTS
CREATE TABLE IF NOT EXISTS courses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    professor TEXT,
    default_room TEXT,
    color_hex TEXT DEFAULT '#3b82f6',
    credits INTEGER DEFAULT 3,
    attendance_goal REAL DEFAULT 75.0,
    total_classes_held INTEGER DEFAULT 0,
    attended_classes INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_courses_user ON courses(user_id);

-- 3. TIMETABLE SLOTS / SCHEDULE
CREATE TABLE IF NOT EXISTS time_slots (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    room TEXT,
    slot_type TEXT DEFAULT 'Lecture',
    notes TEXT,
    meeting_link TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_slots_user ON time_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_slots_course ON time_slots(course_id);

-- 4. TASKS & ASSIGNMENTS
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT NOT NULL,
    due_time TEXT DEFAULT '23:59',
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'todo',
    category TEXT DEFAULT 'assignment',
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);

-- 5. SUBTASKS / CHECKLIST ITEMS
CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);

-- 6. ATTENDANCE LOGS / AUDIT TRAIL
CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    time_slot_id TEXT REFERENCES time_slots(id) ON DELETE SET NULL,
    log_date TEXT NOT NULL DEFAULT (date('now')),
    status TEXT NOT NULL,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_attendance_user_course ON attendance_records(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(log_date);
