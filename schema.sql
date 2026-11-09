-- ============================================================================
-- 🎓 AcademiaSync / CampusFlow PostgreSQL Database Schema
-- Production Ready Schema for College Timetable & Task Management
-- Compatible with PostgreSQL 13+, Supabase, Neon, AWS RDS, Docker Postgres
-- ============================================================================

-- Enable UUID extension for high-performance distributed IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. USERS & PROFILES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    college_name VARCHAR(255),
    branch VARCHAR(150),
    semester VARCHAR(50),
    target_attendance_percentage NUMERIC(5, 2) DEFAULT 75.00,
    theme_preference VARCHAR(50) DEFAULT 'dark-slate',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. COURSES / SUBJECTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(30) NOT NULL,            -- e.g. "CS501"
    name VARCHAR(255) NOT NULL,           -- e.g. "Operating Systems"
    professor VARCHAR(150),
    default_room VARCHAR(80),             -- e.g. "Hall 302"
    color_hex VARCHAR(20) DEFAULT '#3b82f6',
    credits INTEGER DEFAULT 3,
    attendance_goal NUMERIC(5, 2) DEFAULT 75.00,
    total_classes_held INTEGER DEFAULT 0,
    attended_classes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast user course queries
CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id);

-- ----------------------------------------------------------------------------
-- 3. TIMETABLE SLOTS / SCHEDULE
-- ----------------------------------------------------------------------------
CREATE TYPE day_of_week_enum AS ENUM (
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
);

CREATE TYPE slot_type_enum AS ENUM (
    'Lecture', 'Lab', 'Tutorial', 'Seminar', 'Club / Activity'
);

CREATE TABLE IF NOT EXISTS time_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    day_of_week day_of_week_enum NOT NULL,
    start_time TIME NOT NULL,              -- e.g. '09:00:00'
    end_time TIME NOT NULL,                -- e.g. '10:00:00'
    room VARCHAR(80),                      -- Specific room if different from default
    slot_type slot_type_enum DEFAULT 'Lecture',
    meeting_link TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_slot_time_order CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_time_slots_user_day ON time_slots(user_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_time_slots_course ON time_slots(course_id);

-- ----------------------------------------------------------------------------
-- 4. TASKS, ASSIGNMENTS & EXAMS
-- ----------------------------------------------------------------------------
CREATE TYPE task_priority_enum AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_status_enum AS ENUM ('todo', 'in-progress', 'completed');
CREATE TYPE task_category_enum AS ENUM ('assignment', 'exam', 'project', 'quiz', 'reading', 'personal');

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    due_time TIME DEFAULT '23:59:00',
    priority task_priority_enum DEFAULT 'medium',
    status task_status_enum DEFAULT 'todo',
    category task_category_enum DEFAULT 'assignment',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);

-- Subtasks table for task checklists
CREATE TABLE IF NOT EXISTS subtasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);

-- ----------------------------------------------------------------------------
-- 5. ATTENDANCE LOGS
-- ----------------------------------------------------------------------------
CREATE TYPE attendance_status_enum AS ENUM ('present', 'absent', 'cancelled', 'holiday');

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    time_slot_id UUID REFERENCES time_slots(id) ON DELETE SET NULL,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status attendance_status_enum NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_course ON attendance_records(user_id, course_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(log_date);

-- ----------------------------------------------------------------------------
-- 6. HELPFUL VIEWS & ANALYTICS QUERIES
-- ----------------------------------------------------------------------------

-- View: Calculated Attendance Percentage & Bunk Margins
CREATE OR REPLACE VIEW view_course_attendance_analytics AS
SELECT 
    c.id AS course_id,
    c.user_id,
    c.code,
    c.name,
    c.total_classes_held,
    c.attended_classes,
    c.attendance_goal,
    CASE 
        WHEN c.total_classes_held = 0 THEN 100.00
        ELSE ROUND((c.attended_classes::NUMERIC / c.total_classes_held::NUMERIC) * 100, 2)
    END AS current_attendance_percentage,
    -- Safe Bunks Calculator: How many more classes can be missed while staying >= target
    -- Formula: floor((Attended - Target% * Total) / Target%)
    CASE 
        WHEN c.total_classes_held = 0 THEN 0
        WHEN (c.attended_classes::NUMERIC / c.total_classes_held::NUMERIC) >= (c.attendance_goal / 100.0) 
        THEN FLOOR((c.attended_classes - (c.attendance_goal / 100.0 * c.total_classes_held)) / (c.attendance_goal / 100.0))
        ELSE 0
    END AS safe_bunks_available,
    -- Classes Needed to recover: How many consecutive classes must be attended to reach target
    -- Formula: ceil((Target% * Total - Attended) / (1 - Target%))
    CASE 
        WHEN c.total_classes_held = 0 THEN 0
        WHEN (c.attended_classes::NUMERIC / c.total_classes_held::NUMERIC) < (c.attendance_goal / 100.0)
        THEN CEIL(((c.attendance_goal / 100.0 * c.total_classes_held) - c.attended_classes) / (1 - (c.attendance_goal / 100.0)))
        ELSE 0
    END AS classes_needed_to_reach_goal
FROM courses c;

-- ----------------------------------------------------------------------------
-- 7. AUTO-UPDATE TIMESTAMP TRIGGER FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE OR REPLACE TRIGGER set_timestamp_courses
BEFORE UPDATE ON courses
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

CREATE OR REPLACE TRIGGER set_timestamp_tasks
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
