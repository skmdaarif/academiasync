import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auto-copy .env.example to .env if missing for zero-config onboarding
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');
if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  try {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('📝 Initialized .env from .env.example for zero-config startup.');
  } catch {
    // Ignore copy error
  }
}

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'academiasync-secret-jwt-key-2026';

// ----------------------------------------------------------------------------
// ZERO-CONFIG EMBEDDED SQLITE DATABASE
// ----------------------------------------------------------------------------
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'academiasync.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`🗄️  Connected to zero-config SQLite database: ${path.relative(__dirname, dbPath)}`);

// Initialize Relational Schema
db.exec(`
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

  CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id);

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

  CREATE TABLE IF NOT EXISTS academic_semesters (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    semester_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    start_date TEXT,
    end_date TEXT,
    final_attendance_pct REAL,
    credits_earned INTEGER DEFAULT 0,
    sgpa REAL,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_semesters_user ON academic_semesters(user_id);

  CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    exam_category TEXT NOT NULL DEFAULT 'mtt',
    exam_type TEXT NOT NULL DEFAULT 'theory',
    exam_date TEXT NOT NULL,
    start_time TEXT,
    end_time TEXT,
    room_or_lab TEXT,
    max_marks REAL,
    marks_obtained REAL,
    syllabus_units TEXT,
    semester_number INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_exams_user ON exams(user_id);

  CREATE TABLE IF NOT EXISTS academic_holidays (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    is_off_day INTEGER DEFAULT 1,
    notes TEXT,
    semester_number INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_holidays_user ON academic_holidays(user_id);

  CREATE TABLE IF NOT EXISTS schedule_overrides (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    run_day_schedule TEXT NOT NULL,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_overrides_user ON schedule_overrides(user_id);
  CREATE INDEX IF NOT EXISTS idx_overrides_date ON schedule_overrides(date);
`);

// Safe Schema Column Migrations
function ensureColumn(table, column, definition) {
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some(col => col.name === column)) {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
      console.log(`✨ Migrated ${table}: added column ${column}`);
    }
  } catch (err) {
    console.error(`Migration check warning on ${table}.${column}:`, err.message);
  }
}

ensureColumn('users', 'admission_type', "TEXT DEFAULT 'fresh'");
ensureColumn('users', 'active_semester_number', 'INTEGER DEFAULT 1');
ensureColumn('users', 'semester_start_date', 'TEXT');
ensureColumn('users', 'student_batch', 'TEXT');
ensureColumn('users', 'excused_policy', "TEXT DEFAULT 'exemption'");
ensureColumn('users', 'initial_attendance_pct', 'REAL');
ensureColumn('academic_semesters', 'marksheet_ref', 'TEXT');
ensureColumn('courses', 'semester_number', 'INTEGER DEFAULT 1');
ensureColumn('courses', 'baseline_classes_held', 'INTEGER DEFAULT 0');
ensureColumn('courses', 'baseline_attended_classes', 'INTEGER DEFAULT 0');
ensureColumn('courses', 'syllabus_url', 'TEXT');
ensureColumn('courses', 'drive_folder_link', 'TEXT');
ensureColumn('courses', 'professor_email', 'TEXT');
ensureColumn('courses', 'cabin_room', 'TEXT');
ensureColumn('time_slots', 'semester_number', 'INTEGER DEFAULT 1');
ensureColumn('time_slots', 'recurrence', "TEXT DEFAULT 'all'");
ensureColumn('time_slots', 'is_one_off', 'INTEGER DEFAULT 0');
ensureColumn('time_slots', 'specific_date', 'TEXT');
ensureColumn('time_slots', 'batch', 'TEXT');
ensureColumn('time_slots', 'duration_multiplier', 'INTEGER DEFAULT 1');
ensureColumn('tasks', 'semester_number', 'INTEGER DEFAULT 1');
ensureColumn('tasks', 'submission_url', 'TEXT');
ensureColumn('attendance_records', 'semester_number', 'INTEGER DEFAULT 1');
ensureColumn('attendance_records', 'document_ref', 'TEXT');
ensureColumn('attendance_records', 'periods_count', 'INTEGER DEFAULT 1');
ensureColumn('exams', 'seat_number', 'TEXT');
ensureColumn('exams', 'session', "TEXT DEFAULT 'morning'");
ensureColumn('exams', 'is_result_awaiting', 'INTEGER DEFAULT 0');

console.log('✅ SQLite relational schema, multi-semester tables, exams, holidays & migrations verified.');

// ----------------------------------------------------------------------------
// MIDDLEWARES & AUTHENTICATION
// ----------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: '15mb' }));

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err && decoded) {
        req.user = decoded;
      }
      next();
    });
  } else {
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

app.use(authenticateToken);

// Health Check
app.get('/api/health', (req, res) => {
  try {
    const row = db.prepare("SELECT datetime('now') as current_time").get();
    res.json({
      status: 'ok',
      mode: 'sqlite',
      database: path.basename(dbPath),
      currentTime: row.current_time,
    });
  } catch (err) {
    res.json({
      status: 'fallback',
      mode: 'local',
      message: 'Running in local browser fallback storage mode.',
      error: err.message,
    });
  }
});

// Helper: Query all relational tables for a student
function fetchFullStudentData(userId, defaultTheme = 'dark-slate') {
  const courses = db.prepare(`
    SELECT id, code, name, professor, default_room as defaultRoom, color_hex as color,
           credits, attendance_goal as attendanceGoal, total_classes_held as totalClasses,
           attended_classes as attendedClasses,
           COALESCE(baseline_classes_held, 0) as baselineClassesHeld,
           COALESCE(baseline_attended_classes, 0) as baselineAttendedClasses,
           syllabus_url as syllabusUrl,
           drive_folder_link as driveFolderLink,
           professor_email as professorEmail,
           cabin_room as cabinRoom,
           COALESCE(semester_number, 1) as semesterNumber
    FROM courses
    WHERE user_id = ?
    ORDER BY created_at ASC
  `).all(userId);

  const timeSlotsRaw = db.prepare(`
    SELECT id, course_id as courseId, day_of_week as day,
           start_time as startTime, end_time as endTime, room,
           slot_type as type, notes, meeting_link as meetingLink,
           COALESCE(recurrence, 'all') as recurrence,
           (is_one_off = 1) as isOneOff,
           specific_date as specificDate,
           batch,
           COALESCE(duration_multiplier, 1) as durationMultiplier,
           COALESCE(semester_number, 1) as semesterNumber
    FROM time_slots
    WHERE user_id = ?
    ORDER BY start_time ASC
  `).all(userId);

  const timeSlots = timeSlotsRaw.map((s) => ({
    ...s,
    isOneOff: Boolean(s.isOneOff),
  }));

  const tasksRaw = db.prepare(`
    SELECT id, course_id as courseId, title, description,
           due_date as dueDate, due_time as dueTime, priority, status,
           category, submission_url as submissionUrl, created_at as createdAt,
           COALESCE(semester_number, 1) as semesterNumber
    FROM tasks
    WHERE user_id = ?
    ORDER BY due_date ASC
  `).all(userId);

  const subtasksRaw = db.prepare(`
    SELECT st.id, st.task_id as taskId, st.title, (st.is_completed = 1) as completed
    FROM subtasks st
    JOIN tasks t ON st.task_id = t.id
    WHERE t.user_id = ?
    ORDER BY st.sort_order ASC
  `).all(userId);

  const subtasksMap = new Map();
  subtasksRaw.forEach((st) => {
    if (!subtasksMap.has(st.taskId)) {
      subtasksMap.set(st.taskId, []);
    }
    subtasksMap.get(st.taskId).push({ id: st.id, title: st.title, completed: Boolean(st.completed) });
  });

  const tasks = tasksRaw.map((t) => ({
    ...t,
    subtasks: subtasksMap.get(t.id) || [],
  }));

  const attendanceRecords = db.prepare(`
    SELECT id, course_id as courseId, log_date as date, status, note, document_ref as documentRef,
           time_slot_id as slotId,
           COALESCE(periods_count, 1) as periodsCount,
           COALESCE(semester_number, 1) as semesterNumber
    FROM attendance_records
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId);

  const userRow = db.prepare('SELECT active_semester_number, semester FROM users WHERE id = ?').get(userId);
  const activeSemesterNumber = userRow?.active_semester_number || 1;

  let semesters = db.prepare(`
    SELECT id, user_id as userId, semester_number as semesterNumber,
           title, status, start_date as startDate, end_date as endDate,
           final_attendance_pct as finalAttendancePct, credits_earned as creditsEarned,
           sgpa, marksheet_ref as marksheetRef, notes, created_at as createdAt
    FROM academic_semesters
    WHERE user_id = ?
    ORDER BY semester_number ASC
  `).all(userId);

  // Auto-synthesize active semester for existing users with no semester records
  if (semesters.length === 0) {
    const semTitle = userRow?.semester || `Semester ${activeSemesterNumber}`;
    const autoSemId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO academic_semesters (id, user_id, semester_number, title, status, credits_earned)
      VALUES (?, ?, ?, ?, 'active', 0)
    `).run(autoSemId, userId, activeSemesterNumber, semTitle);
    semesters = [{
      id: autoSemId,
      userId,
      semesterNumber: activeSemesterNumber,
      title: semTitle,
      status: 'active',
      creditsEarned: 0,
    }];
  }

  const examsRaw = db.prepare(`
    SELECT id, user_id as userId, course_id as courseId, title,
           exam_category as examCategory, exam_type as examType,
           exam_date as examDate, start_time as startTime, end_time as endTime,
           room_or_lab as roomOrLab, seat_number as seatNumber,
           COALESCE(session, 'morning') as session,
           max_marks as maxMarks,
           marks_obtained as marksObtained,
           COALESCE(is_result_awaiting, 0) as isResultAwaiting,
           syllabus_units as syllabusUnitsRaw,
           COALESCE(semester_number, 1) as semesterNumber, notes, created_at as createdAt
    FROM exams
    WHERE user_id = ?
    ORDER BY exam_date ASC, start_time ASC
  `).all(userId);

  const exams = examsRaw.map((ex) => {
    let syllabusUnits = [];
    if (ex.syllabusUnitsRaw) {
      try {
        syllabusUnits = JSON.parse(ex.syllabusUnitsRaw);
      } catch {
        syllabusUnits = [];
      }
    }
    const { syllabusUnitsRaw, isResultAwaiting, ...rest } = ex;
    return { ...rest, isResultAwaiting: Boolean(isResultAwaiting), syllabusUnits };
  });

  const holidays = db.prepare(`
    SELECT id, user_id as userId, title, start_date as startDate, end_date as endDate,
           (is_off_day = 1) as isOffDay, notes,
           COALESCE(semester_number, 1) as semesterNumber, created_at as createdAt
    FROM academic_holidays
    WHERE user_id = ?
    ORDER BY start_date ASC
  `).all(userId).map(h => ({ ...h, isOffDay: Boolean(h.isOffDay) }));

  const scheduleOverrides = db.prepare(`
    SELECT id, user_id as userId, date, run_day_schedule as runDaySchedule,
           reason, created_at as createdAt
    FROM schedule_overrides
    WHERE user_id = ?
    ORDER BY date ASC
  `).all(userId);

  return {
    courses,
    timeSlots,
    tasks,
    attendanceRecords,
    semesters,
    exams,
    holidays,
    scheduleOverrides,
    activeSemesterNumber,
    theme: defaultTheme,
    activeView: 'dashboard',
  };
}

// ----------------------------------------------------------------------------
// AUTHENTICATION ROUTES
// ----------------------------------------------------------------------------

// 1. Register Student
app.post('/api/auth/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      country,
      collegeName,
      branch,
      degreeType,
      semester,
      semesterStartDate,
      studentBatch,
      excusedPolicy,
      collegeMinAttendance,
      personalGoalAttendance,
      admissionType,
      backfilledSemesters,
      midSemCatchup,
    } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    // Password Complexity Rules
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter (A-Z).' });
    }
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one lowercase letter (a-z).' });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one number (0-9).' });
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one special character (!@#$%^&*).' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const minAtt = Number(collegeMinAttendance) || 75;
    let persGoal = Number(personalGoalAttendance) || minAtt;
    if (persGoal < minAtt) persGoal = minAtt;

    const parsedSem = parseInt(String(semester).replace(/\D/g, ''), 10);
    const activeSemNumber = !isNaN(parsedSem) && parsedSem > 0 ? parsedSem : 1;
    const finalAdmissionType = admissionType || (activeSemNumber > 1 ? 'continuing' : 'fresh');

    const userId = crypto.randomUUID();

    const initialAttPct = midSemCatchup?.attendancePct != null ? Number(midSemCatchup.attendancePct) : null;

    const registerTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (
          id, full_name, email, password_hash, country, college_name,
          branch, degree_type, semester, total_semesters,
          college_min_attendance, personal_attendance_goal, target_attendance_percentage,
          theme_preference, admission_type, active_semester_number,
          semester_start_date, student_batch, excused_policy, initial_attendance_pct
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        name.trim(),
        normalizedEmail,
        passwordHash,
        country || 'India',
        collegeName || 'National Institute of Technology',
        branch || 'Computer Science & Engineering',
        degreeType || 'B.Tech / B.E.',
        semester || `Semester ${activeSemNumber}`,
        8,
        minAtt,
        persGoal,
        minAtt,
        'dark-slate',
        finalAdmissionType,
        activeSemNumber,
        semesterStartDate || null,
        studentBatch || null,
        excusedPolicy || 'exemption',
        initialAttPct
      );

      // Create Active Semester record
      db.prepare(`
        INSERT INTO academic_semesters (
          id, user_id, semester_number, title, status, start_date, credits_earned
        ) VALUES (?, ?, ?, ?, 'active', date('now'), 0)
      `).run(
        crypto.randomUUID(),
        userId,
        activeSemNumber,
        semester || `Semester ${activeSemNumber}`
      );

      // Insert any Backfilled Past Semesters for continuing students
      if (Array.isArray(backfilledSemesters) && backfilledSemesters.length > 0) {
        const insertSem = db.prepare(`
          INSERT INTO academic_semesters (
            id, user_id, semester_number, title, status, final_attendance_pct, credits_earned, sgpa, notes
          ) VALUES (?, ?, ?, ?, 'backfilled', ?, ?, ?, ?)
        `);
        for (const b of backfilledSemesters) {
          insertSem.run(
            crypto.randomUUID(),
            userId,
            b.semesterNumber,
            b.title || `Semester ${b.semesterNumber}`,
            b.finalAttendancePct ?? null,
            b.creditsEarned ?? 0,
            b.sgpa ?? null,
            b.notes || null
          );
        }
      }

      // Insert Mid-Semester Catch-up tasks (completed & pending) and conducted exams
      if (midSemCatchup) {
        const { completedTasks, pendingTasks, conductedExams } = midSemCatchup;

        // 1. Insert completed tasks (already submitted in elapsed weeks)
        if (Array.isArray(completedTasks) && completedTasks.length > 0) {
          const insertTask = db.prepare(`
            INSERT INTO tasks (
              id, user_id, title, due_date, due_time, priority, status, category, semester_number, created_at
            ) VALUES (?, ?, ?, ?, ?, 'medium', 'completed', 'assignment', ?, datetime('now'))
          `);
          for (const t of completedTasks) {
            if (!t || !t.title) continue;
            insertTask.run(
              crypto.randomUUID(),
              userId,
              t.title.trim(),
              t.dueDate || new Date().toISOString().split('T')[0],
              t.dueTime || '23:59',
              activeSemNumber
            );
          }
        }

        // 2. Insert pending/ongoing tasks (assigned & active)
        if (Array.isArray(pendingTasks) && pendingTasks.length > 0) {
          const insertPending = db.prepare(`
            INSERT INTO tasks (
              id, user_id, title, due_date, due_time, priority, status, category, submission_url, semester_number, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'assignment', ?, ?, datetime('now'))
          `);
          for (const t of pendingTasks) {
            if (!t || !t.title) continue;
            insertPending.run(
              crypto.randomUUID(),
              userId,
              t.title.trim(),
              t.dueDate || new Date().toISOString().split('T')[0],
              t.dueTime || '23:59',
              t.priority || 'medium',
              t.status || 'todo',
              t.submissionUrl || null,
              activeSemNumber
            );
          }
        }

        // 3. Insert conducted exams (already taken e.g. MTT 1, CA 1)
        if (Array.isArray(conductedExams) && conductedExams.length > 0) {
          const insertExam = db.prepare(`
            INSERT INTO exams (
              id, user_id, title, exam_category, exam_type, exam_date,
              max_marks, marks_obtained, is_result_awaiting, semester_number, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Conducted prior to onboarding')
          `);
          for (const e of conductedExams) {
            if (!e || !e.title) continue;
            const isAwaiting = Boolean(e.isResultAwaiting);
            insertExam.run(
              crypto.randomUUID(),
              userId,
              e.title.trim(),
              e.examCategory || 'mtt',
              e.examType || 'theory',
              e.examDate || new Date().toISOString().split('T')[0],
              e.maxMarks != null ? Number(e.maxMarks) : null,
              !isAwaiting && e.marksObtained != null ? Number(e.marksObtained) : null,
              isAwaiting ? 1 : 0,
              activeSemNumber
            );
          }
        }
      }
    });

    registerTx();

    const user = {
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      country: country || 'India',
      collegeName: collegeName || 'National Institute of Technology',
      branch: branch || 'Computer Science & Engineering',
      degreeType: degreeType || 'B.Tech / B.E.',
      semester: semester || `Semester ${activeSemNumber}`,
      totalSemesters: 8,
      admissionType: finalAdmissionType,
      activeSemesterNumber: activeSemNumber,
      semesterStartDate: semesterStartDate || undefined,
      studentBatch: studentBatch || undefined,
      excusedPolicy: excusedPolicy || 'exemption',
      initialAttendancePct: initialAttPct != null ? initialAttPct : undefined,
      collegeMinAttendance: minAtt,
      personalGoalAttendance: persGoal,
      targetAttendance: minAtt,
      theme: 'dark-slate',
    };

    const data = fetchFullStudentData(userId, user.theme);
    const token = generateToken(user);
    res.status(201).json({
      success: true,
      token,
      user,
      data,
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ error: 'Server error during registration: ' + err.message });
  }
});

// 2. Login Student
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userRow = db.prepare(`
      SELECT id, full_name, email, password_hash, country, college_name,
             branch, degree_type, semester, total_semesters,
             college_min_attendance, personal_attendance_goal, target_attendance_percentage,
             theme_preference, semester_start_date, admission_type, active_semester_number,
             student_batch, excused_policy, initial_attendance_pct
      FROM users WHERE LOWER(email) = ?
    `).get(normalizedEmail);

    if (!userRow) {
      return res.status(404).json({ error: 'No account found with this email. Please sign up.' });
    }

    const match = await bcrypt.compare(password, userRow.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const collegeMin = Number(userRow.college_min_attendance || userRow.target_attendance_percentage || 75);
    const personalGoal = Number(userRow.personal_attendance_goal || collegeMin);
    const activeSemNumber = userRow.active_semester_number || parseInt(String(userRow.semester).replace(/\D/g, ''), 10) || 1;

    const user = {
      id: userRow.id,
      name: userRow.full_name,
      email: userRow.email,
      country: userRow.country,
      collegeName: userRow.college_name,
      branch: userRow.branch,
      degreeType: userRow.degree_type,
      semester: userRow.semester || `Semester ${activeSemNumber}`,
      totalSemesters: userRow.total_semesters || 8,
      admissionType: userRow.admission_type || 'fresh',
      activeSemesterNumber: activeSemNumber,
      semesterStartDate: userRow.semester_start_date || undefined,
      studentBatch: userRow.student_batch || undefined,
      excusedPolicy: userRow.excused_policy || 'exemption',
      initialAttendancePct: userRow.initial_attendance_pct != null ? Number(userRow.initial_attendance_pct) : undefined,
      collegeMinAttendance: collegeMin,
      personalGoalAttendance: personalGoal,
      targetAttendance: collegeMin,
      theme: userRow.theme_preference || 'dark-slate',
    };

    const data = fetchFullStudentData(user.id, user.theme);
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user,
      data,
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Server error during login: ' + err.message });
  }
});

// ----------------------------------------------------------------------------
// DATA CRUD OPERATIONS (Direct SQLite)
// ----------------------------------------------------------------------------

// Fetch All Student Data
app.get('/api/data/:userId', requireAuth, (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Forbidden: Access denied to other student data.' });
    }
    const userRow = db.prepare('SELECT theme_preference FROM users WHERE id = ?').get(userId);
    const theme = userRow?.theme_preference || 'dark-slate';
    const data = fetchFullStudentData(userId, theme);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// ACADEMIC SEMESTER & VAULT ENDPOINTS
// ----------------------------------------------------------------------------

// Fetch All Semesters for a Student
app.get('/api/semesters/:userId', requireAuth, (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }
    const semesters = db.prepare(`
      SELECT id, user_id as userId, semester_number as semesterNumber,
             title, status, start_date as startDate, end_date as endDate,
             final_attendance_pct as finalAttendancePct, credits_earned as creditsEarned,
             sgpa, marksheet_ref as marksheetRef, notes, created_at as createdAt
      FROM academic_semesters
      WHERE user_id = ?
      ORDER BY semester_number ASC
    `).all(userId);
    res.json(semesters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backfill or Update Past Semesters
app.post('/api/semesters/backfill', requireAuth, (req, res) => {
  try {
    const { userId, semesters } = req.body;
    const effectiveUserId = req.user.id || userId;
    if (req.user.id !== effectiveUserId) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }
    if (!Array.isArray(semesters)) {
      return res.status(400).json({ error: 'Semesters array is required.' });
    }

    const backfillTx = db.transaction(() => {
      for (const sem of semesters) {
        const existing = db.prepare(`
          SELECT id FROM academic_semesters WHERE user_id = ? AND semester_number = ?
        `).get(effectiveUserId, sem.semesterNumber);

        if (existing) {
          db.prepare(`
            UPDATE academic_semesters
            SET title = COALESCE(?, title),
                final_attendance_pct = ?,
                credits_earned = ?,
                sgpa = ?,
                marksheet_ref = COALESCE(?, marksheet_ref),
                notes = ?,
                status = COALESCE(?, status)
            WHERE id = ?
          `).run(
            sem.title || `Semester ${sem.semesterNumber}`,
            sem.finalAttendancePct !== undefined ? sem.finalAttendancePct : null,
            sem.creditsEarned !== undefined ? sem.creditsEarned : 0,
            sem.sgpa !== undefined ? sem.sgpa : null,
            sem.marksheetRef !== undefined ? sem.marksheetRef : null,
            sem.notes !== undefined ? sem.notes : null,
            sem.status || 'backfilled',
            existing.id
          );
        } else {
          db.prepare(`
            INSERT INTO academic_semesters (
              id, user_id, semester_number, title, status, final_attendance_pct, credits_earned, sgpa, marksheet_ref, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            crypto.randomUUID(),
            effectiveUserId,
            sem.semesterNumber,
            sem.title || `Semester ${sem.semesterNumber}`,
            sem.status || 'backfilled',
            sem.finalAttendancePct !== undefined ? sem.finalAttendancePct : null,
            sem.creditsEarned !== undefined ? sem.creditsEarned : 0,
            sem.sgpa !== undefined ? sem.sgpa : null,
            sem.marksheetRef || null,
            sem.notes || null
          );
        }
      }
    });

    backfillTx();

    const updatedList = db.prepare(`
      SELECT id, user_id as userId, semester_number as semesterNumber,
             title, status, start_date as startDate, end_date as endDate,
             final_attendance_pct as finalAttendancePct, credits_earned as creditsEarned,
             sgpa, marksheet_ref as marksheetRef, notes, created_at as createdAt
      FROM academic_semesters
      WHERE user_id = ?
      ORDER BY semester_number ASC
    `).all(effectiveUserId);

    res.json({ success: true, semesters: updatedList });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Promote Student to Next Semester
app.post('/api/semesters/promote', requireAuth, (req, res) => {
  try {
    const { userId, nextSemesterNumber, currentSemSummary } = req.body;
    const effectiveUserId = req.user.id || userId;
    if (req.user.id !== effectiveUserId) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }

    const userRow = db.prepare('SELECT active_semester_number FROM users WHERE id = ?').get(effectiveUserId);
    const currSemNumber = userRow?.active_semester_number || 1;
    const nextSem = nextSemesterNumber || (currSemNumber + 1);

    const promoteTx = db.transaction(() => {
      // 1. Archive current active semester
      const existingActive = db.prepare(`
        SELECT id FROM academic_semesters WHERE user_id = ? AND semester_number = ?
      `).get(effectiveUserId, currSemNumber);

      const today = new Date().toISOString().split('T')[0];

      if (existingActive) {
        db.prepare(`
          UPDATE academic_semesters
          SET status = 'archived',
              end_date = ?,
              final_attendance_pct = ?,
              credits_earned = ?,
              sgpa = ?,
              notes = ?
          WHERE id = ?
        `).run(
          today,
          currentSemSummary?.finalAttendancePct !== undefined ? currentSemSummary.finalAttendancePct : null,
          currentSemSummary?.creditsEarned !== undefined ? currentSemSummary.creditsEarned : 0,
          currentSemSummary?.sgpa !== undefined ? currentSemSummary.sgpa : null,
          currentSemSummary?.notes || null,
          existingActive.id
        );
      } else {
        db.prepare(`
          INSERT INTO academic_semesters (
            id, user_id, semester_number, title, status, end_date, final_attendance_pct, credits_earned, sgpa, notes
          ) VALUES (?, ?, ?, ?, 'archived', ?, ?, ?, ?, ?)
        `).run(
          crypto.randomUUID(),
          effectiveUserId,
          currSemNumber,
          `Semester ${currSemNumber}`,
          today,
          currentSemSummary?.finalAttendancePct !== undefined ? currentSemSummary.finalAttendancePct : null,
          currentSemSummary?.creditsEarned !== undefined ? currentSemSummary.creditsEarned : 0,
          currentSemSummary?.sgpa !== undefined ? currentSemSummary.sgpa : null,
          currentSemSummary?.notes || null
        );
      }

      // 2. Create or activate new semester
      const existingNext = db.prepare(`
        SELECT id FROM academic_semesters WHERE user_id = ? AND semester_number = ?
      `).get(effectiveUserId, nextSem);

      if (existingNext) {
        db.prepare(`
          UPDATE academic_semesters
          SET status = 'active', start_date = ?
          WHERE id = ?
        `).run(today, existingNext.id);
      } else {
        db.prepare(`
          INSERT INTO academic_semesters (
            id, user_id, semester_number, title, status, start_date, credits_earned
          ) VALUES (?, ?, ?, ?, 'active', ?, 0)
        `).run(
          crypto.randomUUID(),
          effectiveUserId,
          nextSem,
          `Semester ${nextSem}`,
          today
        );
      }

      // 3. Update user profile to new active semester
      db.prepare(`
        UPDATE users
        SET active_semester_number = ?,
            semester = ?
        WHERE id = ?
      `).run(nextSem, `Semester ${nextSem}`, effectiveUserId);
    });

    promoteTx();

    const fullData = fetchFullStudentData(effectiveUserId);
    const updatedUser = db.prepare(`
      SELECT id, full_name as name, email, country, college_name as collegeName,
             branch, degree_type as degreeType, semester, total_semesters as totalSemesters,
             active_semester_number as activeSemesterNumber, admission_type as admissionType,
             semester_start_date as semesterStartDate, college_min_attendance as collegeMinAttendance,
             personal_attendance_goal as personalGoalAttendance, theme_preference as theme
      FROM users WHERE id = ?
    `).get(effectiveUserId);

    res.json({
      success: true,
      user: updatedUser,
      data: fullData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Course
app.post('/api/courses', requireAuth, (req, res) => {
  try {
    const {
      userId,
      code,
      name,
      professor,
      defaultRoom,
      color,
      credits,
      attendanceGoal,
      totalClasses,
      attendedClasses,
      baselineClassesHeld,
      baselineAttendedClasses,
      syllabusUrl,
      driveFolderLink,
      professorEmail,
      cabinRoom,
      semesterNumber,
    } = req.body;

    const effectiveUserId = req.user.id || userId;
    const userRow = db.prepare('SELECT active_semester_number FROM users WHERE id = ?').get(effectiveUserId);
    const semNumber = Number(semesterNumber) || userRow?.active_semester_number || 1;

    const totalHeld = Math.max(0, parseInt(totalClasses, 10) || 0);
    const attended = Math.min(totalHeld, Math.max(0, parseInt(attendedClasses, 10) || 0));
    const baseHeld = Math.max(0, parseInt(baselineClassesHeld, 10) || 0);
    const baseAttended = Math.min(baseHeld, Math.max(0, parseInt(baselineAttendedClasses, 10) || 0));
    const courseId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO courses (
        id, user_id, code, name, professor, default_room, color_hex,
        credits, attendance_goal, total_classes_held, attended_classes,
        baseline_classes_held, baseline_attended_classes,
        syllabus_url, drive_folder_link, professor_email, cabin_room,
        semester_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      courseId,
      effectiveUserId,
      code.trim(),
      name.trim(),
      professor || null,
      defaultRoom || null,
      color || '#3b82f6',
      credits || 3,
      attendanceGoal || 75,
      totalHeld,
      attended,
      baseHeld,
      baseAttended,
      syllabusUrl || null,
      driveFolderLink || null,
      professorEmail || null,
      cabinRoom || null,
      semNumber
    );

    const created = db.prepare(`
      SELECT id, code, name, professor, default_room as defaultRoom, color_hex as color,
             credits, attendance_goal as attendanceGoal, total_classes_held as totalClasses,
             attended_classes as attendedClasses,
             COALESCE(baseline_classes_held, 0) as baselineClassesHeld,
             COALESCE(baseline_attended_classes, 0) as baselineAttendedClasses,
             syllabus_url as syllabusUrl,
             drive_folder_link as driveFolderLink,
             professor_email as professorEmail,
             cabin_room as cabinRoom,
             COALESCE(semester_number, 1) as semesterNumber
      FROM courses WHERE id = ?
    `).get(courseId);

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Course
app.put('/api/courses/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      professor,
      defaultRoom,
      color,
      credits,
      attendanceGoal,
      totalClasses,
      attendedClasses,
      baselineClassesHeld,
      baselineAttendedClasses,
      syllabusUrl,
      driveFolderLink,
      professorEmail,
      cabinRoom,
    } = req.body;

    const existing = db.prepare('SELECT * FROM courses WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Course not found or access denied.' });
    }

    db.prepare(`
      UPDATE courses
      SET code = COALESCE(?, code),
          name = COALESCE(?, name),
          professor = ?,
          default_room = ?,
          color_hex = COALESCE(?, color_hex),
          credits = COALESCE(?, credits),
          attendance_goal = COALESCE(?, attendance_goal),
          total_classes_held = COALESCE(?, total_classes_held),
          attended_classes = COALESCE(?, attended_classes),
          baseline_classes_held = COALESCE(?, baseline_classes_held),
          baseline_attended_classes = COALESCE(?, baseline_attended_classes),
          syllabus_url = ?,
          drive_folder_link = ?,
          professor_email = ?,
          cabin_room = ?
      WHERE id = ? AND user_id = ?
    `).run(
      code || null,
      name || null,
      professor !== undefined ? professor : existing.professor,
      defaultRoom !== undefined ? defaultRoom : existing.default_room,
      color || null,
      credits !== undefined ? credits : null,
      attendanceGoal !== undefined ? attendanceGoal : null,
      totalClasses !== undefined ? totalClasses : null,
      attendedClasses !== undefined ? attendedClasses : null,
      baselineClassesHeld !== undefined ? baselineClassesHeld : null,
      baselineAttendedClasses !== undefined ? baselineAttendedClasses : null,
      syllabusUrl !== undefined ? syllabusUrl : existing.syllabus_url,
      driveFolderLink !== undefined ? driveFolderLink : existing.drive_folder_link,
      professorEmail !== undefined ? professorEmail : existing.professor_email,
      cabinRoom !== undefined ? cabinRoom : existing.cabin_room,
      id,
      req.user.id
    );

    const updated = db.prepare(`
      SELECT id, code, name, professor, default_room as defaultRoom, color_hex as color,
             credits, attendance_goal as attendanceGoal, total_classes_held as totalClasses,
             attended_classes as attendedClasses,
             COALESCE(baseline_classes_held, 0) as baselineClassesHeld,
             COALESCE(baseline_attended_classes, 0) as baselineAttendedClasses,
             syllabus_url as syllabusUrl,
             drive_folder_link as driveFolderLink,
             professor_email as professorEmail,
             cabin_room as cabinRoom,
             COALESCE(semester_number, 1) as semesterNumber
      FROM courses WHERE id = ?
    `).get(id);

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Course
app.delete('/api/courses/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM courses WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Time Slot
app.post('/api/slots', requireAuth, (req, res) => {
  try {
    const { 
      userId, 
      courseId, 
      day, 
      startTime, 
      endTime, 
      room, 
      type, 
      notes, 
      recurrence,
      isOneOff,
      specificDate,
      batch,
      durationMultiplier,
      semesterNumber 
    } = req.body;
    const effectiveUserId = req.user.id || userId;
    const userRow = db.prepare('SELECT active_semester_number FROM users WHERE id = ?').get(effectiveUserId);
    const semNumber = Number(semesterNumber) || userRow?.active_semester_number || 1;
    const slotId = crypto.randomUUID();
    const multiplier = Math.max(1, parseInt(durationMultiplier, 10) || 1);

    db.prepare(`
      INSERT INTO time_slots (
        id, user_id, course_id, day_of_week, start_time, end_time, room, slot_type, notes,
        recurrence, is_one_off, specific_date, batch, duration_multiplier, semester_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      slotId,
      effectiveUserId,
      courseId,
      day,
      startTime,
      endTime,
      room || null,
      type || 'Lecture',
      notes || null,
      recurrence || 'all',
      isOneOff ? 1 : 0,
      specificDate || null,
      batch || null,
      multiplier,
      semNumber
    );

    const created = db.prepare(`
      SELECT id, course_id as courseId, day_of_week as day,
             start_time as startTime, end_time as endTime, room,
             slot_type as type, notes,
             COALESCE(recurrence, 'all') as recurrence,
             (is_one_off = 1) as isOneOff,
             specific_date as specificDate,
             batch,
             COALESCE(duration_multiplier, 1) as durationMultiplier,
             COALESCE(semester_number, 1) as semesterNumber
      FROM time_slots WHERE id = ?
    `).get(slotId);

    created.isOneOff = Boolean(created.isOneOff);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Time Slot
app.put('/api/slots/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { courseId, day, startTime, endTime, room, type, notes, recurrence, isOneOff, specificDate, batch, durationMultiplier } = req.body;

    const existing = db.prepare('SELECT * FROM time_slots WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Time slot not found or access denied.' });
    }

    db.prepare(`
      UPDATE time_slots
      SET course_id = COALESCE(?, course_id),
          day_of_week = COALESCE(?, day_of_week),
          start_time = COALESCE(?, start_time),
          end_time = COALESCE(?, end_time),
          room = ?,
          slot_type = COALESCE(?, slot_type),
          notes = ?,
          recurrence = COALESCE(?, recurrence),
          is_one_off = ?,
          specific_date = ?,
          batch = ?,
          duration_multiplier = ?
      WHERE id = ? AND user_id = ?
    `).run(
      courseId || null,
      day || null,
      startTime || null,
      endTime || null,
      room !== undefined ? room : existing.room,
      type || null,
      notes !== undefined ? notes : existing.notes,
      recurrence || null,
      isOneOff !== undefined ? (isOneOff ? 1 : 0) : existing.is_one_off,
      specificDate !== undefined ? specificDate : existing.specific_date,
      batch !== undefined ? batch : existing.batch,
      durationMultiplier !== undefined ? Math.max(1, parseInt(durationMultiplier, 10) || 1) : existing.duration_multiplier,
      id,
      req.user.id
    );

    const updated = db.prepare(`
      SELECT id, course_id as courseId, day_of_week as day,
             start_time as startTime, end_time as endTime, room,
             slot_type as type, notes,
             COALESCE(recurrence, 'all') as recurrence,
             (is_one_off = 1) as isOneOff,
             specific_date as specificDate,
             batch,
             COALESCE(duration_multiplier, 1) as durationMultiplier,
             COALESCE(semester_number, 1) as semesterNumber
      FROM time_slots WHERE id = ?
    `).get(id);

    updated.isOneOff = Boolean(updated.isOneOff);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Time Slot
app.delete('/api/slots/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM time_slots WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Task (Atomic Transaction)
app.post('/api/tasks', requireAuth, (req, res) => {
  try {
    const { userId, courseId, title, description, dueDate, dueTime, priority, status, category, submissionUrl, subtasks, semesterNumber } = req.body;
    const effectiveUserId = req.user.id || userId;
    const userRow = db.prepare('SELECT active_semester_number FROM users WHERE id = ?').get(effectiveUserId);
    const semNumber = Number(semesterNumber) || userRow?.active_semester_number || 1;
    const taskId = crypto.randomUUID();

    const insertTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO tasks (
          id, user_id, course_id, title, description, due_date, due_time,
          priority, status, category, submission_url, semester_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        taskId,
        effectiveUserId,
        courseId || null,
        title.trim(),
        description || null,
        dueDate,
        dueTime || '23:59',
        priority || 'medium',
        status || 'todo',
        category || 'assignment',
        submissionUrl || null,
        semNumber
      );

      const createdSubtasks = [];
      if (Array.isArray(subtasks) && subtasks.length > 0) {
        const insertSt = db.prepare(`
          INSERT INTO subtasks (id, task_id, title, is_completed, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (let i = 0; i < subtasks.length; i++) {
          const st = subtasks[i];
          const stId = crypto.randomUUID();
          insertSt.run(stId, taskId, st.title, st.completed ? 1 : 0, i);
          createdSubtasks.push({ id: stId, title: st.title, completed: Boolean(st.completed) });
        }
      }
      return createdSubtasks;
    });

    const createdSubtasks = insertTx();

    const createdTask = db.prepare(`
      SELECT id, course_id as courseId, title, description,
             due_date as dueDate, due_time as dueTime, priority, status,
             category, submission_url as submissionUrl, created_at as createdAt,
             COALESCE(semester_number, 1) as semesterNumber
      FROM tasks WHERE id = ?
    `).get(taskId);

    createdTask.subtasks = createdSubtasks;
    res.status(201).json(createdTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Task (Atomic Transaction)
app.put('/api/tasks/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, dueDate, dueTime, priority, status, category, submissionUrl, subtasks } = req.body;

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found or access denied.' });
    }

    const updateTx = db.transaction(() => {
      db.prepare(`
        UPDATE tasks
        SET title = COALESCE(?, title),
            description = ?,
            due_date = COALESCE(?, due_date),
            due_time = COALESCE(?, due_time),
            priority = COALESCE(?, priority),
            status = COALESCE(?, status),
            category = COALESCE(?, category),
            submission_url = ?
        WHERE id = ? AND user_id = ?
      `).run(
        title || null,
        description !== undefined ? description : existing.description,
        dueDate || null,
        dueTime || null,
        priority || null,
        status || null,
        category || null,
        submissionUrl !== undefined ? submissionUrl : existing.submission_url,
        id,
        req.user.id
      );

      if (Array.isArray(subtasks)) {
        db.prepare('DELETE FROM subtasks WHERE task_id = ?').run(id);
        const insertSt = db.prepare(`
          INSERT INTO subtasks (id, task_id, title, is_completed, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (let i = 0; i < subtasks.length; i++) {
          const st = subtasks[i];
          const stId = st.id || crypto.randomUUID();
          insertSt.run(stId, id, st.title, st.completed ? 1 : 0, i);
        }
      }
    });

    updateTx();

    const updatedTask = db.prepare(`
      SELECT id, course_id as courseId, title, description,
             due_date as dueDate, due_time as dueTime, priority, status,
             category, submission_url as submissionUrl, created_at as createdAt,
             COALESCE(semester_number, 1) as semesterNumber
      FROM tasks WHERE id = ?
    `).get(id);

    const currentSubtasks = db.prepare(`
      SELECT id, title, (is_completed = 1) as completed
      FROM subtasks WHERE task_id = ?
      ORDER BY sort_order ASC
    `).all(id);

    updatedTask.subtasks = currentSubtasks.map((st) => ({ ...st, completed: Boolean(st.completed) }));
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Task
app.delete('/api/tasks/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log Attendance (Atomic Transaction with Multi-Period Lab Weighting)
app.post('/api/attendance', requireAuth, (req, res) => {
  try {
    const { userId, courseId, status, date, note, documentRef, durationMultiplier, periodsCount, semesterNumber } = req.body;
    const effectiveUserId = req.user.id || userId;
    const userRow = db.prepare('SELECT active_semester_number, excused_policy FROM users WHERE id = ?').get(effectiveUserId);
    const semNumber = Number(semesterNumber) || userRow?.active_semester_number || 1;
    const isExcusedCredit = userRow?.excused_policy === 'credit' && status === 'excused';

    const recordId = crypto.randomUUID();
    const logDate = date || new Date().toISOString().split('T')[0];
    const multiplier = Math.max(1, parseInt(durationMultiplier || periodsCount, 10) || 1);

    const isPresent = status === 'present' || isExcusedCredit;
    const isCounted = status === 'present' || status === 'absent' || isExcusedCredit;
    const heldIncrement = isCounted ? multiplier : 0;
    const attendedIncrement = isPresent ? multiplier : 0;

    const logTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO attendance_records (id, user_id, course_id, log_date, status, note, document_ref, periods_count, semester_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(recordId, effectiveUserId, courseId, logDate, status, note || null, documentRef || null, multiplier, semNumber);

      if (heldIncrement > 0) {
        db.prepare(`
          UPDATE courses
          SET total_classes_held = total_classes_held + ?,
              attended_classes = attended_classes + ?
          WHERE id = ? AND user_id = ?
        `).run(heldIncrement, attendedIncrement, courseId, effectiveUserId);
      }
    });

    logTx();

    const record = db.prepare(`
      SELECT id, course_id as courseId, log_date as date, status, note, document_ref as documentRef,
             COALESCE(periods_count, 1) as periodsCount,
             COALESCE(semester_number, 1) as semesterNumber
      FROM attendance_records WHERE id = ?
    `).get(recordId);

    const updatedCourse = db.prepare(`
      SELECT id, code, name, total_classes_held as totalClasses, attended_classes as attendedClasses
      FROM courses WHERE id = ? AND user_id = ?
    `).get(courseId, effectiveUserId);

    res.status(201).json({ record, updatedCourse });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Specific Attendance Record (e.g. from history view)
app.delete('/api/attendance/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const rec = db.prepare('SELECT id, user_id, course_id, status, COALESCE(periods_count, 1) as periods_count FROM attendance_records WHERE id = ?').get(id);

    if (!rec) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }
    if (req.user.id !== rec.user_id) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }

    const userRow = db.prepare('SELECT excused_policy FROM users WHERE id = ?').get(rec.user_id);
    const isExcusedCredit = userRow?.excused_policy === 'credit' && rec.status === 'excused';

    const mult = rec.periods_count || 1;
    const isPresent = rec.status === 'present' || isExcusedCredit;
    const isCounted = rec.status === 'present' || rec.status === 'absent' || isExcusedCredit;
    const heldDecrement = isCounted ? mult : 0;
    const attendedDecrement = isPresent ? mult : 0;

    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM attendance_records WHERE id = ?').run(id);

      if (heldDecrement > 0) {
        db.prepare(`
          UPDATE courses
          SET total_classes_held = MAX(0, total_classes_held - ?),
              attended_classes = MAX(0, attended_classes - ?)
          WHERE id = ? AND user_id = ?
        `).run(heldDecrement, attendedDecrement, rec.course_id, req.user.id);
      }
    });

    deleteTx();

    const updatedCourse = db.prepare(`
      SELECT id, code, name, total_classes_held as totalClasses, attended_classes as attendedClasses
      FROM courses WHERE id = ? AND user_id = ?
    `).get(rec.course_id, req.user.id);

    res.json({
      success: true,
      deletedRecordId: id,
      updatedCourse,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Undo Attendance (Atomic Transaction & Accurate Reversion with Period Weighting)
app.post('/api/attendance/undo', requireAuth, (req, res) => {
  try {
    const { userId, courseId } = req.body;
    const effectiveUserId = req.user.id || userId;

    const latestRec = db.prepare(`
      SELECT id, status, COALESCE(periods_count, 1) as periods_count FROM attendance_records
      WHERE user_id = ? AND course_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(effectiveUserId, courseId);

    const userRow = db.prepare('SELECT excused_policy FROM users WHERE id = ?').get(effectiveUserId);
    const isExcusedCredit = userRow?.excused_policy === 'credit' && latestRec?.status === 'excused';

    let wasPresent = false;
    let wasCounted = false;
    let deletedRecordId = null;
    let mult = 1;

    if (latestRec) {
      mult = latestRec.periods_count || 1;
      wasPresent = latestRec.status === 'present' || isExcusedCredit;
      wasCounted = latestRec.status === 'present' || latestRec.status === 'absent' || isExcusedCredit;
      deletedRecordId = latestRec.id;
    }

    const undoTx = db.transaction(() => {
      if (latestRec) {
        db.prepare('DELETE FROM attendance_records WHERE id = ?').run(latestRec.id);
      } else {
        const currCourse = db.prepare('SELECT total_classes_held, attended_classes FROM courses WHERE id = ? AND user_id = ?').get(courseId, effectiveUserId);
        if (currCourse && currCourse.attended_classes > 0) {
          wasPresent = true;
          wasCounted = true;
        }
      }

      const attendedDecrement = wasPresent ? mult : 0;
      const heldDecrement = wasCounted ? mult : 0;

      db.prepare(`
        UPDATE courses
        SET total_classes_held = MAX(0, total_classes_held - ?),
            attended_classes = MAX(0, attended_classes - ?)
        WHERE id = ? AND user_id = ?
      `).run(heldDecrement, attendedDecrement, courseId, effectiveUserId);
    });

    undoTx();

    const updatedCourse = db.prepare(`
      SELECT id, code, name, total_classes_held as totalClasses, attended_classes as attendedClasses
      FROM courses WHERE id = ? AND user_id = ?
    `).get(courseId, effectiveUserId);

    res.json({
      deletedRecordId,
      updatedCourse,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// EXAMS & ASSESSMENTS CRUD
// ----------------------------------------------------------------------------

// Fetch Exams for a Student
app.get('/api/exams/:userId', requireAuth, (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }

    const examsRaw = db.prepare(`
      SELECT id, user_id as userId, course_id as courseId, title,
             exam_category as examCategory, exam_type as examType,
             exam_date as examDate, start_time as startTime, end_time as endTime,
             room_or_lab as roomOrLab, seat_number as seatNumber,
             COALESCE(session, 'morning') as session,
             max_marks as maxMarks,
             marks_obtained as marksObtained, syllabus_units as syllabusUnitsRaw,
             COALESCE(semester_number, 1) as semesterNumber, notes, created_at as createdAt
      FROM exams
      WHERE user_id = ?
      ORDER BY exam_date ASC, start_time ASC
    `).all(userId);

    const exams = examsRaw.map((ex) => {
      let syllabusUnits = [];
      if (ex.syllabusUnitsRaw) {
        try {
          syllabusUnits = JSON.parse(ex.syllabusUnitsRaw);
        } catch {
          syllabusUnits = [];
        }
      }
      const { syllabusUnitsRaw, ...rest } = ex;
      return { ...rest, syllabusUnits };
    });

    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Exam
app.post('/api/exams', requireAuth, (req, res) => {
  try {
    const {
      userId,
      courseId,
      title,
      examCategory,
      examType,
      examDate,
      startTime,
      endTime,
      roomOrLab,
      seatNumber,
      session,
      maxMarks,
      marksObtained,
      isResultAwaiting,
      syllabusUnits,
      semesterNumber,
      notes,
    } = req.body;

    const effectiveUserId = req.user.id || userId;
    const userRow = db.prepare('SELECT active_semester_number FROM users WHERE id = ?').get(effectiveUserId);
    const semNumber = Number(semesterNumber) || userRow?.active_semester_number || 1;
    const examId = crypto.randomUUID();

    const syllabusJson = Array.isArray(syllabusUnits) ? JSON.stringify(syllabusUnits) : null;
    const awaitingFlag = isResultAwaiting ? 1 : 0;

    db.prepare(`
      INSERT INTO exams (
        id, user_id, course_id, title, exam_category, exam_type, exam_date,
        start_time, end_time, room_or_lab, seat_number, session, max_marks, marks_obtained,
        is_result_awaiting, syllabus_units, semester_number, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      examId,
      effectiveUserId,
      courseId || null,
      title.trim(),
      examCategory || 'mtt',
      examType || 'theory',
      examDate,
      startTime || null,
      endTime || null,
      roomOrLab || null,
      seatNumber || null,
      session || 'morning',
      maxMarks !== undefined && maxMarks !== '' ? Number(maxMarks) : null,
      !awaitingFlag && marksObtained !== undefined && marksObtained !== '' ? Number(marksObtained) : null,
      awaitingFlag,
      syllabusJson,
      semNumber,
      notes || null
    );

    const created = db.prepare(`
      SELECT id, user_id as userId, course_id as courseId, title,
             exam_category as examCategory, exam_type as examType,
             exam_date as examDate, start_time as startTime, end_time as endTime,
             room_or_lab as roomOrLab, seat_number as seatNumber,
             COALESCE(session, 'morning') as session,
             max_marks as maxMarks,
             marks_obtained as marksObtained,
             COALESCE(is_result_awaiting, 0) as isResultAwaiting,
             syllabus_units as syllabusUnitsRaw,
             COALESCE(semester_number, 1) as semesterNumber, notes, created_at as createdAt
      FROM exams WHERE id = ?
    `).get(examId);

    let parsedUnits = [];
    if (created.syllabusUnitsRaw) {
      try {
        parsedUnits = JSON.parse(created.syllabusUnitsRaw);
      } catch {
        parsedUnits = [];
      }
    }
    delete created.syllabusUnitsRaw;
    created.isResultAwaiting = Boolean(created.isResultAwaiting);
    created.syllabusUnits = parsedUnits;

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Exam
app.put('/api/exams/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const {
      courseId,
      title,
      examCategory,
      examType,
      examDate,
      startTime,
      endTime,
      roomOrLab,
      seatNumber,
      session,
      maxMarks,
      marksObtained,
      isResultAwaiting,
      syllabusUnits,
      notes,
    } = req.body;

    const existing = db.prepare('SELECT * FROM exams WHERE id = ? AND user_id = ?').get(id, req.user.id);
    if (!existing) {
      return res.status(404).json({ error: 'Exam not found or access denied.' });
    }

    const syllabusJson = Array.isArray(syllabusUnits)
      ? JSON.stringify(syllabusUnits)
      : existing.syllabus_units;

    const awaitingFlag = isResultAwaiting !== undefined
      ? (isResultAwaiting ? 1 : 0)
      : (marksObtained !== undefined && marksObtained !== '' ? 0 : existing.is_result_awaiting);

    db.prepare(`
      UPDATE exams
      SET course_id = ?,
          title = COALESCE(?, title),
          exam_category = COALESCE(?, exam_category),
          exam_type = COALESCE(?, exam_type),
          exam_date = COALESCE(?, exam_date),
          start_time = ?,
          end_time = ?,
          room_or_lab = ?,
          seat_number = ?,
          session = COALESCE(?, session),
          max_marks = ?,
          marks_obtained = ?,
          is_result_awaiting = ?,
          syllabus_units = ?,
          notes = ?
      WHERE id = ? AND user_id = ?
    `).run(
      courseId !== undefined ? courseId : existing.course_id,
      title || null,
      examCategory || null,
      examType || null,
      examDate || null,
      startTime !== undefined ? startTime : existing.start_time,
      endTime !== undefined ? endTime : existing.end_time,
      roomOrLab !== undefined ? roomOrLab : existing.room_or_lab,
      seatNumber !== undefined ? seatNumber : existing.seat_number,
      session || null,
      maxMarks !== undefined && maxMarks !== '' ? Number(maxMarks) : existing.max_marks,
      awaitingFlag ? null : (marksObtained !== undefined && marksObtained !== '' ? Number(marksObtained) : existing.marks_obtained),
      awaitingFlag,
      syllabusJson,
      notes !== undefined ? notes : existing.notes,
      id,
      req.user.id
    );

    const updated = db.prepare(`
      SELECT id, user_id as userId, course_id as courseId, title,
             exam_category as examCategory, exam_type as examType,
             exam_date as examDate, start_time as startTime, end_time as endTime,
             room_or_lab as roomOrLab, seat_number as seatNumber,
             COALESCE(session, 'morning') as session,
             max_marks as maxMarks,
             marks_obtained as marksObtained,
             COALESCE(is_result_awaiting, 0) as isResultAwaiting,
             syllabus_units as syllabusUnitsRaw,
             COALESCE(semester_number, 1) as semesterNumber, notes, created_at as createdAt
      FROM exams WHERE id = ?
    `).get(id);

    let parsedUnits = [];
    if (updated.syllabusUnitsRaw) {
      try {
        parsedUnits = JSON.parse(updated.syllabusUnitsRaw);
      } catch {
        parsedUnits = [];
      }
    }
    delete updated.syllabusUnitsRaw;
    updated.isResultAwaiting = Boolean(updated.isResultAwaiting);
    updated.syllabusUnits = parsedUnits;

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Exam
app.delete('/api/exams/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM exams WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// ACADEMIC HOLIDAYS & RECESS ROUTES
// ----------------------------------------------------------------------------

// Fetch Holidays
app.get('/api/holidays/:userId', requireAuth, (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }

    const holidays = db.prepare(`
      SELECT id, user_id as userId, title, start_date as startDate, end_date as endDate,
             (is_off_day = 1) as isOffDay, notes,
             COALESCE(semester_number, 1) as semesterNumber, created_at as createdAt
      FROM academic_holidays
      WHERE user_id = ?
      ORDER BY start_date ASC
    `).all(userId).map(h => ({ ...h, isOffDay: Boolean(h.isOffDay) }));

    res.json(holidays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Holiday
app.post('/api/holidays', requireAuth, (req, res) => {
  try {
    const { userId, title, startDate, endDate, isOffDay, notes, semesterNumber } = req.body;
    const effectiveUserId = req.user.id || userId;
    const userRow = db.prepare('SELECT active_semester_number FROM users WHERE id = ?').get(effectiveUserId);
    const semNumber = Number(semesterNumber) || userRow?.active_semester_number || 1;
    const holidayId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO academic_holidays (id, user_id, title, start_date, end_date, is_off_day, notes, semester_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      holidayId,
      effectiveUserId,
      title.trim(),
      startDate,
      endDate,
      isOffDay === false ? 0 : 1,
      notes || null,
      semNumber
    );

    const created = db.prepare(`
      SELECT id, user_id as userId, title, start_date as startDate, end_date as endDate,
             (is_off_day = 1) as isOffDay, notes,
             COALESCE(semester_number, 1) as semesterNumber, created_at as createdAt
      FROM academic_holidays WHERE id = ?
    `).get(holidayId);

    created.isOffDay = Boolean(created.isOffDay);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Holiday
app.delete('/api/holidays/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM academic_holidays WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Schedule Day Override (e.g. Run Monday Timetable on Saturday)
app.post('/api/schedule-overrides', requireAuth, (req, res) => {
  try {
    const { userId, date, runDaySchedule, reason } = req.body;
    const effectiveUserId = req.user.id || userId;
    const overrideId = crypto.randomUUID();

    // Check if an override for this date already exists; if so, replace it
    const existing = db.prepare('SELECT id FROM schedule_overrides WHERE user_id = ? AND date = ?').get(effectiveUserId, date);
    if (existing) {
      db.prepare(`
        UPDATE schedule_overrides
        SET run_day_schedule = ?, reason = ?
        WHERE id = ?
      `).run(runDaySchedule, reason || null, existing.id);

      const updated = db.prepare(`
        SELECT id, user_id as userId, date, run_day_schedule as runDaySchedule, reason, created_at as createdAt
        FROM schedule_overrides WHERE id = ?
      `).get(existing.id);
      return res.json(updated);
    }

    db.prepare(`
      INSERT INTO schedule_overrides (id, user_id, date, run_day_schedule, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(overrideId, effectiveUserId, date, runDaySchedule, reason || null);

    const created = db.prepare(`
      SELECT id, user_id as userId, date, run_day_schedule as runDaySchedule, reason, created_at as createdAt
      FROM schedule_overrides WHERE id = ?
    `).get(overrideId);

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Schedule Override
app.delete('/api/schedule-overrides/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM schedule_overrides WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update User Profile
app.put('/api/users/profile', requireAuth, (req, res) => {
  try {
    const {
      id,
      name,
      collegeName,
      branch,
      degreeType,
      semester,
      semesterStartDate,
      studentBatch,
      excusedPolicy,
      collegeMinAttendance,
      personalGoalAttendance,
      theme,
    } = req.body;

    if (req.user.id !== id) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }

    const minAtt = collegeMinAttendance !== undefined ? Number(collegeMinAttendance) : null;
    let persGoal = personalGoalAttendance !== undefined ? Number(personalGoalAttendance) : null;
    if (minAtt !== null && persGoal !== null && persGoal < minAtt) {
      persGoal = minAtt;
    }

    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'User not found.' });
    }

    db.prepare(`
      UPDATE users
      SET full_name = COALESCE(?, full_name),
          college_name = COALESCE(?, college_name),
          branch = COALESCE(?, branch),
          degree_type = COALESCE(?, degree_type),
          semester = COALESCE(?, semester),
          semester_start_date = ?,
          student_batch = ?,
          excused_policy = COALESCE(?, excused_policy),
          college_min_attendance = COALESCE(?, college_min_attendance),
          personal_attendance_goal = COALESCE(?, personal_attendance_goal),
          target_attendance_percentage = COALESCE(?, target_attendance_percentage),
          theme_preference = COALESCE(?, theme_preference)
      WHERE id = ?
    `).run(
      name || null,
      collegeName || null,
      branch || null,
      degreeType || null,
      semester || null,
      semesterStartDate !== undefined ? semesterStartDate : existing.semester_start_date,
      studentBatch !== undefined ? studentBatch : existing.student_batch,
      excusedPolicy || null,
      minAtt,
      persGoal,
      minAtt,
      theme || null,
      id
    );

    const updated = db.prepare(`
      SELECT id, full_name as name, email, country, college_name as collegeName,
             branch, degree_type as degreeType, semester, total_semesters as totalSemesters,
             semester_start_date as semesterStartDate, student_batch as studentBatch,
             excused_policy as excusedPolicy, initial_attendance_pct as initialAttendancePct,
             college_min_attendance as collegeMinAttendance,
             personal_attendance_goal as personalGoalAttendance, theme_preference as theme
      FROM users WHERE id = ?
    `).get(id);

    updated.collegeMinAttendance = Number(updated.collegeMinAttendance || 75);
    updated.personalGoalAttendance = Number(updated.personalGoalAttendance || updated.collegeMinAttendance);
    updated.targetAttendance = updated.collegeMinAttendance;
    if (updated.initialAttendancePct != null) {
      updated.initialAttendancePct = Number(updated.initialAttendancePct);
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mid-Semester Catch-Up Endpoint (for existing users to calibrate anytime)
app.post('/api/users/mid-sem-catchup', requireAuth, (req, res) => {
  try {
    const { attendancePct, completedTasks, pendingTasks, conductedExams, applyToExistingCourses } = req.body;
    const userId = req.user.id;

    const userRow = db.prepare('SELECT active_semester_number FROM users WHERE id = ?').get(userId);
    const activeSemNumber = userRow?.active_semester_number || 1;

    const catchupTx = db.transaction(() => {
      // 1. Update initial attendance pct if provided
      if (attendancePct != null) {
        db.prepare('UPDATE users SET initial_attendance_pct = ? WHERE id = ?').run(Number(attendancePct), userId);

        // Optionally apply to active courses that currently have 0 attendance records
        if (applyToExistingCourses) {
          const courses = db.prepare('SELECT id, baseline_classes_held, baseline_attended_classes FROM courses WHERE user_id = ? AND semester_number = ?').all(userId, activeSemNumber);
          const updateCourseBaseline = db.prepare('UPDATE courses SET baseline_classes_held = ?, baseline_attended_classes = ? WHERE id = ?');
          for (const c of courses) {
            const assumedHeld = Math.max(20, c.baseline_classes_held || 30);
            const assumedAttended = Math.round(assumedHeld * (Number(attendancePct) / 100));
            updateCourseBaseline.run(assumedHeld, assumedAttended, c.id);
          }
        }
      }

      // 2. Insert completed tasks
      if (Array.isArray(completedTasks) && completedTasks.length > 0) {
        const insertTask = db.prepare(`
          INSERT INTO tasks (
            id, user_id, course_id, title, due_date, due_time, priority, status, category, semester_number, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'medium', 'completed', 'assignment', ?, datetime('now'))
        `);
        for (const t of completedTasks) {
          if (!t || !t.title) continue;
          insertTask.run(
            crypto.randomUUID(),
            userId,
            t.courseId || null,
            t.title.trim(),
            t.dueDate || new Date().toISOString().split('T')[0],
            t.dueTime || '23:59',
            activeSemNumber
          );
        }
      }

      // 3. Insert pending tasks
      if (Array.isArray(pendingTasks) && pendingTasks.length > 0) {
        const insertPending = db.prepare(`
          INSERT INTO tasks (
            id, user_id, course_id, title, due_date, due_time, priority, status, category, submission_url, semester_number, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'assignment', ?, ?, datetime('now'))
        `);
        for (const t of pendingTasks) {
          if (!t || !t.title) continue;
          insertPending.run(
            crypto.randomUUID(),
            userId,
            t.courseId || null,
            t.title.trim(),
            t.dueDate || new Date().toISOString().split('T')[0],
            t.dueTime || '23:59',
            t.priority || 'medium',
            t.status || 'todo',
            t.submissionUrl || null,
            activeSemNumber
          );
        }
      }

      // 4. Insert conducted exams
      if (Array.isArray(conductedExams) && conductedExams.length > 0) {
        const insertExam = db.prepare(`
          INSERT INTO exams (
            id, user_id, course_id, title, exam_category, exam_type, exam_date,
            max_marks, marks_obtained, is_result_awaiting, semester_number, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Conducted prior to onboarding')
        `);
        for (const e of conductedExams) {
          if (!e || !e.title) continue;
          const isAwaiting = Boolean(e.isResultAwaiting);
          insertExam.run(
            crypto.randomUUID(),
            userId,
            e.courseId || null,
            e.title.trim(),
            e.examCategory || 'mtt',
            e.examType || 'theory',
            e.examDate || new Date().toISOString().split('T')[0],
            e.maxMarks != null ? Number(e.maxMarks) : null,
            !isAwaiting && e.marksObtained != null ? Number(e.marksObtained) : null,
            isAwaiting ? 1 : 0,
            activeSemNumber
          );
        }
      }
    });

    catchupTx();

    const data = fetchFullStudentData(userId);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Mid-Sem Catch-up Error:', err);
    res.status(500).json({ error: 'Failed to process mid-semester catch-up: ' + err.message });
  }
});

// Clear / Wipe Student Data (Atomic Transaction)
app.post('/api/data/wipe', requireAuth, (req, res) => {
  try {
    const { userId } = req.body;
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }

    const wipeTx = db.transaction(() => {
      db.prepare('DELETE FROM attendance_records WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM tasks WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM time_slots WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM courses WHERE user_id = ?').run(userId);
    });

    wipeTx();
    res.json({ success: true, message: 'All student data cleared successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Student Account & All Data (Atomic Transaction)
app.delete('/api/users/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id !== id) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own account.' });
    }

    const deleteAccountTx = db.transaction(() => {
      db.prepare('DELETE FROM attendance_records WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM tasks WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM time_slots WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM exams WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM academic_holidays WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM schedule_overrides WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM academic_semesters WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM courses WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    });

    deleteAccountTx();
    res.json({ success: true, message: 'Student account and all associated data permanently deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore Student Data Backup to SQLite (Atomic Transaction)
app.post('/api/data/restore', requireAuth, (req, res) => {
  try {
    const { userId, data } = req.body;
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }
    if (!userId || !data) {
      return res.status(400).json({ error: 'User ID and backup data are required.' });
    }

    const restoreTx = db.transaction(() => {
      // 1. Clear existing user data
      db.prepare('DELETE FROM attendance_records WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM tasks WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM time_slots WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM courses WHERE user_id = ?').run(userId);

      // 2. Insert courses & track mapping
      const courseIdMap = new Map();
      if (Array.isArray(data.courses)) {
        const insertCourse = db.prepare(`
          INSERT INTO courses (
            id, user_id, code, name, professor, default_room, color_hex,
            credits, attendance_goal, total_classes_held, attended_classes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const c of data.courses) {
          const newCourseId = c.id && c.id.length > 5 ? c.id : crypto.randomUUID();
          courseIdMap.set(c.id, newCourseId);
          insertCourse.run(
            newCourseId,
            userId,
            c.code || 'COURSE',
            c.name || 'Untitled Course',
            c.professor || null,
            c.defaultRoom || null,
            c.color || '#3b82f6',
            c.credits || 3,
            c.attendanceGoal || 75,
            c.totalClasses || 0,
            c.attendedClasses || 0
          );
        }
      }

      // 3. Insert Time Slots
      if (Array.isArray(data.timeSlots)) {
        const insertSlot = db.prepare(`
          INSERT INTO time_slots (
            id, user_id, course_id, day_of_week, start_time, end_time, room, slot_type, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const s of data.timeSlots) {
          const targetCourseId = courseIdMap.get(s.courseId) || s.courseId;
          const slotId = s.id && s.id.length > 5 ? s.id : crypto.randomUUID();
          insertSlot.run(
            slotId,
            userId,
            targetCourseId,
            s.day,
            s.startTime,
            s.endTime,
            s.room || null,
            s.type || 'Lecture',
            s.notes || null
          );
        }
      }

      // 4. Insert Tasks & Subtasks
      if (Array.isArray(data.tasks)) {
        const insertTask = db.prepare(`
          INSERT INTO tasks (
            id, user_id, course_id, title, description, due_date, due_time, priority, status, category
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertSubtask = db.prepare(`
          INSERT INTO subtasks (id, task_id, title, is_completed, sort_order)
          VALUES (?, ?, ?, ?, ?)
        `);

        for (const t of data.tasks) {
          const targetCourseId = t.courseId ? courseIdMap.get(t.courseId) || t.courseId : null;
          const newTaskId = t.id && t.id.length > 5 ? t.id : crypto.randomUUID();
          insertTask.run(
            newTaskId,
            userId,
            targetCourseId,
            t.title || 'Untitled Task',
            t.description || null,
            t.dueDate || new Date().toISOString().split('T')[0],
            t.dueTime || '23:59',
            t.priority || 'medium',
            t.status || 'todo',
            t.category || 'assignment'
          );

          if (Array.isArray(t.subtasks)) {
            for (let i = 0; i < t.subtasks.length; i++) {
              const st = t.subtasks[i];
              const stId = st.id && st.id.length > 5 ? st.id : crypto.randomUUID();
              insertSubtask.run(stId, newTaskId, st.title, st.completed ? 1 : 0, i);
            }
          }
        }
      }

      // 5. Insert Attendance Records
      if (Array.isArray(data.attendanceRecords)) {
        const insertAtt = db.prepare(`
          INSERT INTO attendance_records (id, user_id, course_id, log_date, status, note, semester_number)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const a of data.attendanceRecords) {
          const targetCourseId = courseIdMap.get(a.courseId) || a.courseId;
          const attId = a.id && a.id.length > 5 ? a.id : crypto.randomUUID();
          insertAtt.run(
            attId,
            userId,
            targetCourseId,
            a.date || new Date().toISOString().split('T')[0],
            a.status || 'present',
            a.note || null,
            Number(a.semesterNumber) || 1
          );
        }
      }

      // 6. Insert Academic Semesters
      if (Array.isArray(data.semesters) && data.semesters.length > 0) {
        db.prepare('DELETE FROM academic_semesters WHERE user_id = ?').run(userId);
        const insertSem = db.prepare(`
          INSERT INTO academic_semesters (
            id, user_id, semester_number, title, status, start_date, end_date,
            final_attendance_pct, credits_earned, sgpa, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const s of data.semesters) {
          insertSem.run(
            s.id && s.id.length > 5 ? s.id : crypto.randomUUID(),
            userId,
            s.semesterNumber,
            s.title || `Semester ${s.semesterNumber}`,
            s.status || 'active',
            s.startDate || null,
            s.endDate || null,
            s.finalAttendancePct !== undefined ? s.finalAttendancePct : null,
            s.creditsEarned !== undefined ? s.creditsEarned : 0,
            s.sgpa !== undefined ? s.sgpa : null,
            s.notes || null
          );
        }
      }

      // 7. Insert Exams
      if (Array.isArray(data.exams) && data.exams.length > 0) {
        db.prepare('DELETE FROM exams WHERE user_id = ?').run(userId);
        const insertEx = db.prepare(`
          INSERT INTO exams (
            id, user_id, course_id, title, exam_category, exam_type, exam_date,
            start_time, end_time, room_or_lab, max_marks, marks_obtained,
            syllabus_units, semester_number, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const ex of data.exams) {
          const targetCourseId = ex.courseId ? courseIdMap.get(ex.courseId) || ex.courseId : null;
          const exId = ex.id && ex.id.length > 5 ? ex.id : crypto.randomUUID();
          insertEx.run(
            exId,
            userId,
            targetCourseId,
            ex.title || 'Untitled Exam',
            ex.examCategory || 'mtt',
            ex.examType || 'theory',
            ex.examDate || new Date().toISOString().split('T')[0],
            ex.startTime || null,
            ex.endTime || null,
            ex.roomOrLab || null,
            ex.maxMarks !== undefined && ex.maxMarks !== '' ? Number(ex.maxMarks) : null,
            ex.marksObtained !== undefined && ex.marksObtained !== '' ? Number(ex.marksObtained) : null,
            Array.isArray(ex.syllabusUnits) ? JSON.stringify(ex.syllabusUnits) : null,
            Number(ex.semesterNumber) || 1,
            ex.notes || null
          );
        }
      }

      // 8. Update user theme preference & active semester if present
      if (data.theme) {
        db.prepare('UPDATE users SET theme_preference = ? WHERE id = ?').run(data.theme, userId);
      }
      if (data.activeSemesterNumber) {
        db.prepare('UPDATE users SET active_semester_number = ?, semester = ? WHERE id = ?')
          .run(data.activeSemesterNumber, `Semester ${data.activeSemesterNumber}`, userId);
      }
    });

    restoreTx();

    const restoredData = fetchFullStudentData(userId, data.theme || 'dark-slate');
    res.json({
      success: true,
      message: 'All student data successfully restored to SQLite database.',
      data: restoredData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------------
// SERVE PRODUCTION CLIENT & SPA ROUTING
// ----------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'dist')));

// Express 5 compatible catch-all
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 AcademiaSync server running at http://localhost:${PORT}`);
  console.log(`📁 Local database engine: SQLite (${path.relative(__dirname, dbPath)})`);
});
