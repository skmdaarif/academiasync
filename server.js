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
`);

console.log('✅ SQLite relational schema and indexes verified.');

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
           attended_classes as attendedClasses
    FROM courses
    WHERE user_id = ?
    ORDER BY created_at ASC
  `).all(userId);

  const timeSlots = db.prepare(`
    SELECT id, course_id as courseId, day_of_week as day,
           start_time as startTime, end_time as endTime, room,
           slot_type as type, notes, meeting_link as meetingLink
    FROM time_slots
    WHERE user_id = ?
    ORDER BY start_time ASC
  `).all(userId);

  const tasksRaw = db.prepare(`
    SELECT id, course_id as courseId, title, description,
           due_date as dueDate, due_time as dueTime, priority, status,
           category, created_at as createdAt
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
    SELECT id, course_id as courseId, log_date as date, status, note, time_slot_id as slotId
    FROM attendance_records
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(userId);

  return {
    courses,
    timeSlots,
    tasks,
    attendanceRecords,
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
      collegeMinAttendance,
      personalGoalAttendance,
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

    const userId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO users (
        id, full_name, email, password_hash, country, college_name,
        branch, degree_type, semester, total_semesters,
        college_min_attendance, personal_attendance_goal, target_attendance_percentage,
        theme_preference
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      name.trim(),
      normalizedEmail,
      passwordHash,
      country || 'India',
      collegeName || 'National Institute of Technology',
      branch || 'Computer Science & Engineering',
      degreeType || 'B.Tech / B.E.',
      semester || 'Semester 5',
      8,
      minAtt,
      persGoal,
      minAtt,
      'dark-slate'
    );

    const user = {
      id: userId,
      name: name.trim(),
      email: normalizedEmail,
      country: country || 'India',
      collegeName: collegeName || 'National Institute of Technology',
      branch: branch || 'Computer Science & Engineering',
      degreeType: degreeType || 'B.Tech / B.E.',
      semester: semester || 'Semester 5',
      totalSemesters: 8,
      collegeMinAttendance: minAtt,
      personalGoalAttendance: persGoal,
      targetAttendance: minAtt,
      theme: 'dark-slate',
    };

    const token = generateToken(user);
    res.status(201).json({
      success: true,
      token,
      user,
      data: {
        courses: [],
        timeSlots: [],
        tasks: [],
        attendanceRecords: [],
        theme: user.theme,
        activeView: 'dashboard',
      },
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
             theme_preference, semester_start_date
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

    const user = {
      id: userRow.id,
      name: userRow.full_name,
      email: userRow.email,
      country: userRow.country,
      collegeName: userRow.college_name,
      branch: userRow.branch,
      degreeType: userRow.degree_type,
      semester: userRow.semester,
      totalSemesters: userRow.total_semesters,
      semesterStartDate: userRow.semester_start_date || undefined,
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
    } = req.body;

    const effectiveUserId = req.user.id || userId;
    const totalHeld = Math.max(0, parseInt(totalClasses, 10) || 0);
    const attended = Math.min(totalHeld, Math.max(0, parseInt(attendedClasses, 10) || 0));
    const courseId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO courses (
        id, user_id, code, name, professor, default_room, color_hex,
        credits, attendance_goal, total_classes_held, attended_classes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      attended
    );

    const created = db.prepare(`
      SELECT id, code, name, professor, default_room as defaultRoom, color_hex as color,
             credits, attendance_goal as attendanceGoal, total_classes_held as totalClasses,
             attended_classes as attendedClasses
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
    const { code, name, professor, defaultRoom, color, credits, attendanceGoal, totalClasses, attendedClasses } = req.body;

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
          attended_classes = COALESCE(?, attended_classes)
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
      id,
      req.user.id
    );

    const updated = db.prepare(`
      SELECT id, code, name, professor, default_room as defaultRoom, color_hex as color,
             credits, attendance_goal as attendanceGoal, total_classes_held as totalClasses,
             attended_classes as attendedClasses
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
    const { userId, courseId, day, startTime, endTime, room, type, notes } = req.body;
    const effectiveUserId = req.user.id || userId;
    const slotId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO time_slots (
        id, user_id, course_id, day_of_week, start_time, end_time, room, slot_type, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      slotId,
      effectiveUserId,
      courseId,
      day,
      startTime,
      endTime,
      room || null,
      type || 'Lecture',
      notes || null
    );

    const created = db.prepare(`
      SELECT id, course_id as courseId, day_of_week as day,
             start_time as startTime, end_time as endTime, room,
             slot_type as type, notes
      FROM time_slots WHERE id = ?
    `).get(slotId);

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Time Slot
app.put('/api/slots/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { courseId, day, startTime, endTime, room, type, notes } = req.body;

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
          notes = ?
      WHERE id = ? AND user_id = ?
    `).run(
      courseId || null,
      day || null,
      startTime || null,
      endTime || null,
      room !== undefined ? room : existing.room,
      type || null,
      notes !== undefined ? notes : existing.notes,
      id,
      req.user.id
    );

    const updated = db.prepare(`
      SELECT id, course_id as courseId, day_of_week as day,
             start_time as startTime, end_time as endTime, room,
             slot_type as type, notes
      FROM time_slots WHERE id = ?
    `).get(id);

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
    const { userId, courseId, title, description, dueDate, dueTime, priority, status, category, subtasks } = req.body;
    const effectiveUserId = req.user.id || userId;
    const taskId = crypto.randomUUID();

    const insertTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO tasks (
          id, user_id, course_id, title, description, due_date, due_time,
          priority, status, category
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        category || 'assignment'
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
             category, created_at as createdAt
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
    const { title, description, dueDate, dueTime, priority, status, category, subtasks } = req.body;

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
            category = COALESCE(?, category)
        WHERE id = ? AND user_id = ?
      `).run(
        title || null,
        description !== undefined ? description : existing.description,
        dueDate || null,
        dueTime || null,
        priority || null,
        status || null,
        category || null,
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
             category, created_at as createdAt
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

// Log Attendance (Atomic Transaction)
app.post('/api/attendance', requireAuth, (req, res) => {
  try {
    const { userId, courseId, status, date, note } = req.body;
    const effectiveUserId = req.user.id || userId;
    const recordId = crypto.randomUUID();
    const logDate = date || new Date().toISOString().split('T')[0];

    const isPresent = status === 'present';
    const isCounted = status === 'present' || status === 'absent';
    const heldIncrement = isCounted ? 1 : 0;
    const attendedIncrement = isPresent ? 1 : 0;

    const logTx = db.transaction(() => {
      db.prepare(`
        INSERT INTO attendance_records (id, user_id, course_id, log_date, status, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(recordId, effectiveUserId, courseId, logDate, status, note || null);

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
      SELECT id, course_id as courseId, log_date as date, status, note
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
    const rec = db.prepare('SELECT id, user_id, course_id, status FROM attendance_records WHERE id = ?').get(id);

    if (!rec) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }
    if (req.user.id !== rec.user_id) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }

    const isPresent = rec.status === 'present';
    const isCounted = rec.status === 'present' || rec.status === 'absent';
    const heldDecrement = isCounted ? 1 : 0;
    const attendedDecrement = isPresent ? 1 : 0;

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

// Undo Attendance (Atomic Transaction & Accurate Reversion)
app.post('/api/attendance/undo', requireAuth, (req, res) => {
  try {
    const { userId, courseId } = req.body;
    const effectiveUserId = req.user.id || userId;

    const latestRec = db.prepare(`
      SELECT id, status FROM attendance_records
      WHERE user_id = ? AND course_id = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(effectiveUserId, courseId);

    let wasPresent = false;
    let wasCounted = false;
    let deletedRecordId = null;

    const undoTx = db.transaction(() => {
      if (latestRec) {
        wasPresent = latestRec.status === 'present';
        wasCounted = latestRec.status === 'present' || latestRec.status === 'absent';
        deletedRecordId = latestRec.id;
        db.prepare('DELETE FROM attendance_records WHERE id = ?').run(latestRec.id);
      } else {
        const currCourse = db.prepare('SELECT total_classes_held, attended_classes FROM courses WHERE id = ? AND user_id = ?').get(courseId, effectiveUserId);
        if (currCourse && currCourse.attended_classes > 0) {
          wasPresent = true;
          wasCounted = true;
        }
      }

      const attendedDecrement = wasPresent ? 1 : 0;
      const heldDecrement = wasCounted ? 1 : 0;

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
      minAtt,
      persGoal,
      minAtt,
      theme || null,
      id
    );

    const updated = db.prepare(`
      SELECT id, full_name as name, email, country, college_name as collegeName,
             branch, degree_type as degreeType, semester, total_semesters as totalSemesters,
             semester_start_date as semesterStartDate, college_min_attendance as collegeMinAttendance,
             personal_attendance_goal as personalGoalAttendance, theme_preference as theme
      FROM users WHERE id = ?
    `).get(id);

    updated.collegeMinAttendance = Number(updated.collegeMinAttendance || 75);
    updated.personalGoalAttendance = Number(updated.personalGoalAttendance || updated.collegeMinAttendance);
    updated.targetAttendance = updated.collegeMinAttendance;

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
          INSERT INTO attendance_records (id, user_id, course_id, log_date, status, note)
          VALUES (?, ?, ?, ?, ?, ?)
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
            a.note || null
          );
        }
      }

      // 6. Update user theme preference if present
      if (data.theme) {
        db.prepare('UPDATE users SET theme_preference = ? WHERE id = ?').run(data.theme, userId);
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
