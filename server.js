import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
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

// PostgreSQL Connection Pool
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    })
  : new Pool({
      database: process.env.PGDATABASE || 'academiasync',
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT) || 5432,
      user: process.env.PGUSER || undefined,
      password: process.env.PGPASSWORD || undefined,
    });

// Handle idle client errors gracefully without crashing process
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

let isDbConnected = false;

// Auto-run schema migration on startup if database is accessible
async function initDatabase() {
  try {
    const client = await pool.connect();
    isDbConnected = true;
    console.log('🐘 PostgreSQL connected successfully.');

    // Check if core users table exists
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
      );
    `);

    if (!checkTable.rows[0].exists) {
      console.log('🔄 First-time setup detected: Auto-executing schema.sql...');
      const schemaFilePath = path.join(__dirname, 'schema.sql');
      if (fs.existsSync(schemaFilePath)) {
        const schemaSql = fs.readFileSync(schemaFilePath, 'utf8');
        await client.query(schemaSql);
        console.log('✅ schema.sql executed successfully! All tables and constraints ready.');
      }
    } else {
      // Ensure excused status enum exists on existing databases
      try {
        await client.query("ALTER TYPE attendance_status_enum ADD VALUE IF NOT EXISTS 'excused';");
      } catch {
        // Ignore if enum type already includes it
      }
    }
    client.release();
  } catch (err) {
    isDbConnected = false;
    console.warn(`⚠️  PostgreSQL is not reachable (${err.message}).`);
    console.log('💡 TIP: AcademiaSync operates seamlessly in 100% Browser Local Storage mode.');
    console.log('💡 TIP: If you wish to use PostgreSQL, start your DB or run `docker compose up -d`.');
  }
}

initDatabase();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth token helper
function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

// Authentication Middleware
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

// Strict Authorization Guard
function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

app.use(authenticateToken);

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT current_database(), current_user, NOW() as current_time;');
    res.json({ status: 'ok', mode: 'postgres', database: dbRes.rows[0] });
  } catch (err) {
    res.json({ 
      status: 'fallback', 
      mode: 'local', 
      message: 'PostgreSQL offline. Running in local browser storage mode.',
      error: err.message 
    });
  }
});

// ----------------------------------------------------------------------------
// AUTHENTICATION ROUTES
// ----------------------------------------------------------------------------

// 1. Student Sign Up (Register)
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

    // Standard Password Constraints
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
      return res.status(400).json({ error: 'Password must contain at least one special character (e.g. !@#$%^&*).' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(email) = $1;', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Calculate total semesters based on degree
    let totalSems = 8;
    if (degreeType && degreeType.includes('6 Semesters')) totalSems = 6;
    else if (degreeType && degreeType.includes('4 Semesters')) totalSems = 4;
    else if (degreeType && degreeType.includes('10 Semesters')) totalSems = 10;
    else if (degreeType && degreeType.includes('9 Semesters')) totalSems = 9;

    const minAtt = Number(collegeMinAttendance) || 75.0;
    const persGoal = Math.max(minAtt, Number(personalGoalAttendance) || Math.max(85.0, minAtt));

    const result = await pool.query(
      `INSERT INTO users (
        full_name, email, password_hash, country, college_name, branch, degree_type, semester, total_semesters, college_min_attendance, personal_attendance_goal, target_attendance_percentage
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, full_name, email, country, college_name, branch, degree_type, semester, total_semesters, college_min_attendance, personal_attendance_goal, theme_preference;`,
      [
        name.trim(),
        normalizedEmail,
        passwordHash,
        country || 'India',
        collegeName || 'University',
        branch || 'Computer Science',
        degreeType || 'B.Tech / B.E. (4 Years - 8 Semesters)',
        semester || 'Semester 1',
        totalSems,
        minAtt,
        persGoal,
        minAtt,
      ]
    );

    const userRow = result.rows[0];
    const collegeMin = Number(userRow.college_min_attendance || 75);
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
      collegeMinAttendance: collegeMin,
      personalGoalAttendance: personalGoal,
      targetAttendance: collegeMin,
      theme: userRow.theme_preference || 'dark-slate',
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

// 2. Student Sign In (Login)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userQuery = await pool.query(
      `SELECT id, full_name, email, password_hash, country, college_name, branch, degree_type, semester, total_semesters, college_min_attendance, personal_attendance_goal, target_attendance_percentage, theme_preference, TO_CHAR(semester_start_date, 'YYYY-MM-DD') as semester_start_date
       FROM users WHERE LOWER(email) = $1;`,
      [normalizedEmail]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with this email. Please sign up.' });
    }

    const userRow = userQuery.rows[0];
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

    const data = await fetchFullStudentData(user.id, user.theme);
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

// Helper function to query all tables for a student
async function fetchFullStudentData(userId, defaultTheme = 'dark-slate') {
  // 1. Courses
  const coursesRes = await pool.query(
    `SELECT id, code, name, professor, default_room as "defaultRoom", color_hex as color, credits, attendance_goal as "attendanceGoal", total_classes_held as "totalClasses", attended_classes as "attendedClasses"
     FROM courses WHERE user_id = $1 ORDER BY created_at ASC;`,
    [userId]
  );

  // 2. Time Slots
  const slotsRes = await pool.query(
    `SELECT id, course_id as "courseId", day_of_week as day, TO_CHAR(start_time, 'HH24:MI') as "startTime", TO_CHAR(end_time, 'HH24:MI') as "endTime", room, slot_type as type, notes, meeting_link as "meetingLink"
     FROM time_slots WHERE user_id = $1 ORDER BY start_time ASC;`,
    [userId]
  );

  // 3. Tasks & Subtasks
  const tasksRes = await pool.query(
    `SELECT id, course_id as "courseId", title, description, TO_CHAR(due_date, 'YYYY-MM-DD') as "dueDate", TO_CHAR(due_time, 'HH24:MI') as "dueTime", priority, status, category, TO_CHAR(created_at, 'YYYY-MM-DD') as "createdAt"
     FROM tasks WHERE user_id = $1 ORDER BY due_date ASC;`,
    [userId]
  );

  const subtasksRes = await pool.query(
    `SELECT st.id, st.task_id as "taskId", st.title, st.is_completed as completed
     FROM subtasks st
     JOIN tasks t ON st.task_id = t.id
     WHERE t.user_id = $1
     ORDER BY st.sort_order ASC;`,
    [userId]
  );

  const subtasksMap = new Map();
  subtasksRes.rows.forEach((st) => {
    if (!subtasksMap.has(st.taskId)) {
      subtasksMap.set(st.taskId, []);
    }
    subtasksMap.get(st.taskId).push({ id: st.id, title: st.title, completed: st.completed });
  });

  const tasks = tasksRes.rows.map((t) => ({
    ...t,
    subtasks: subtasksMap.get(t.id) || [],
  }));

  // 4. Attendance Records
  const attendanceRes = await pool.query(
    `SELECT id, course_id as "courseId", TO_CHAR(log_date, 'YYYY-MM-DD') as date, status, note, time_slot_id as "slotId"
     FROM attendance_records WHERE user_id = $1 ORDER BY created_at DESC;`,
    [userId]
  );

  return {
    courses: coursesRes.rows,
    timeSlots: slotsRes.rows,
    tasks,
    attendanceRecords: attendanceRes.rows,
    theme: defaultTheme,
    activeView: 'dashboard',
  };
}

// ----------------------------------------------------------------------------
// DATA CRUD ROUTES (Direct Postgres Operations)
// ----------------------------------------------------------------------------

// Fetch All Student Data
app.get('/api/data/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Forbidden: Access denied to other student data.' });
    }
    const userRes = await pool.query('SELECT theme_preference FROM users WHERE id = $1;', [userId]);
    const theme = userRes.rows[0]?.theme_preference || 'dark-slate';
    const data = await fetchFullStudentData(userId, theme);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Course (with optional initial mid-semester attendance)
app.post('/api/courses', requireAuth, async (req, res) => {
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
      attendedClasses 
    } = req.body;

    const effectiveUserId = req.user.id || userId;
    const totalHeld = Math.max(0, parseInt(totalClasses, 10) || 0);
    const attended = Math.min(totalHeld, Math.max(0, parseInt(attendedClasses, 10) || 0));

    const result = await pool.query(
      `INSERT INTO courses (user_id, code, name, professor, default_room, color_hex, credits, attendance_goal, total_classes_held, attended_classes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, code, name, professor, default_room as "defaultRoom", color_hex as color, credits, attendance_goal as "attendanceGoal", total_classes_held as "totalClasses", attended_classes as "attendedClasses";`,
      [effectiveUserId, code, name, professor || null, defaultRoom || null, color || '#3b82f6', credits || 3, attendanceGoal || 75, totalHeld, attended]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Course
app.put('/api/courses/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, professor, defaultRoom, color, credits, attendanceGoal, totalClasses, attendedClasses } = req.body;
    const result = await pool.query(
      `UPDATE courses 
       SET code = COALESCE($1, code),
           name = COALESCE($2, name),
           professor = $3,
           default_room = $4,
           color_hex = COALESCE($5, color_hex),
           credits = COALESCE($6, credits),
           attendance_goal = COALESCE($7, attendance_goal),
           total_classes_held = COALESCE($8, total_classes_held),
           attended_classes = COALESCE($9, attended_classes)
       WHERE id = $10 AND user_id = $11
       RETURNING id, code, name, professor, default_room as "defaultRoom", color_hex as color, credits, attendance_goal as "attendanceGoal", total_classes_held as "totalClasses", attended_classes as "attendedClasses";`,
      [code, name, professor, defaultRoom, color, credits, attendanceGoal, totalClasses, attendedClasses, id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found or access denied.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Course
app.delete('/api/courses/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM courses WHERE id = $1 AND user_id = $2;', [id, req.user.id]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Time Slot
app.post('/api/slots', requireAuth, async (req, res) => {
  try {
    const { userId, courseId, day, startTime, endTime, room, type, notes } = req.body;
    const effectiveUserId = req.user.id || userId;
    const result = await pool.query(
      `INSERT INTO time_slots (user_id, course_id, day_of_week, start_time, end_time, room, slot_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, course_id as "courseId", day_of_week as day, TO_CHAR(start_time, 'HH24:MI') as "startTime", TO_CHAR(end_time, 'HH24:MI') as "endTime", room, slot_type as type, notes;`,
      [effectiveUserId, courseId, day, startTime, endTime, room || null, type || 'Lecture', notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Time Slot
app.put('/api/slots/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { courseId, day, startTime, endTime, room, type, notes } = req.body;
    const result = await pool.query(
      `UPDATE time_slots
       SET course_id = COALESCE($1, course_id),
           day_of_week = COALESCE($2, day_of_week),
           start_time = COALESCE($3, start_time),
           end_time = COALESCE($4, end_time),
           room = $5,
           slot_type = COALESCE($6, slot_type),
           notes = $7
       WHERE id = $8 AND user_id = $9
       RETURNING id, course_id as "courseId", day_of_week as day, TO_CHAR(start_time, 'HH24:MI') as "startTime", TO_CHAR(end_time, 'HH24:MI') as "endTime", room, slot_type as type, notes;`,
      [courseId, day, startTime, endTime, room || null, type || 'Lecture', notes || null, id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Time slot not found or access denied.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Time Slot
app.delete('/api/slots/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM time_slots WHERE id = $1 AND user_id = $2;', [id, req.user.id]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Task (Atomic Transaction)
app.post('/api/tasks', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId, courseId, title, description, dueDate, dueTime, priority, status, category, subtasks } = req.body;
    const effectiveUserId = req.user.id || userId;
    await client.query('BEGIN');
    
    const taskRes = await client.query(
      `INSERT INTO tasks (user_id, course_id, title, description, due_date, due_time, priority, status, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, course_id as "courseId", title, description, TO_CHAR(due_date, 'YYYY-MM-DD') as "dueDate", TO_CHAR(due_time, 'HH24:MI') as "dueTime", priority, status, category, TO_CHAR(created_at, 'YYYY-MM-DD') as "createdAt";`,
      [effectiveUserId, courseId || null, title, description || null, dueDate, dueTime || '23:59:00', priority || 'medium', status || 'todo', category || 'assignment']
    );

    const task = taskRes.rows[0];
    const createdSubtasks = [];

    if (Array.isArray(subtasks) && subtasks.length > 0) {
      for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i];
        const stRes = await client.query(
          `INSERT INTO subtasks (task_id, title, is_completed, sort_order)
           VALUES ($1, $2, $3, $4)
           RETURNING id, title, is_completed as completed;`,
          [task.id, st.title, st.completed || false, i]
        );
        createdSubtasks.push(stRes.rows[0]);
      }
    }

    await client.query('COMMIT');
    task.subtasks = createdSubtasks;
    res.status(201).json(task);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update Task (Atomic Transaction)
app.put('/api/tasks/:id', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { title, description, dueDate, dueTime, priority, status, category, subtasks } = req.body;
    await client.query('BEGIN');

    const taskRes = await client.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           description = $2,
           due_date = COALESCE($3, due_date),
           due_time = COALESCE($4, due_time),
           priority = COALESCE($5, priority),
           status = COALESCE($6, status),
           category = COALESCE($7, category)
       WHERE id = $8 AND user_id = $9
       RETURNING id, course_id as "courseId", title, description, TO_CHAR(due_date, 'YYYY-MM-DD') as "dueDate", TO_CHAR(due_time, 'HH24:MI') as "dueTime", priority, status, category;`,
      [title, description, dueDate, dueTime, priority, status, category, id, req.user.id]
    );

    if (taskRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Task not found or access denied.' });
    }

    if (Array.isArray(subtasks)) {
      await client.query('DELETE FROM subtasks WHERE task_id = $1;', [id]);
      for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i];
        await client.query(
          `INSERT INTO subtasks (task_id, title, is_completed, sort_order)
           VALUES ($1, $2, $3, $4);`,
          [id, st.title, st.completed || false, i]
        );
      }
    }

    await client.query('COMMIT');
    const updatedTask = taskRes.rows[0];
    const currentSubtasks = await pool.query('SELECT id, title, is_completed as completed FROM subtasks WHERE task_id = $1 ORDER BY sort_order ASC;', [id]);
    updatedTask.subtasks = currentSubtasks.rows;

    res.json(updatedTask);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Delete Task
app.delete('/api/tasks/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2;', [id, req.user.id]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log Attendance (Atomic Transaction)
app.post('/api/attendance', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId, courseId, status, date, note } = req.body;
    const effectiveUserId = req.user.id || userId;
    await client.query('BEGIN');
    
    // 1. Insert record
    const attRes = await client.query(
      `INSERT INTO attendance_records (user_id, course_id, log_date, status, note)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5)
       RETURNING id, course_id as "courseId", TO_CHAR(log_date, 'YYYY-MM-DD') as date, status, note;`,
      [effectiveUserId, courseId, date || null, status, note || null]
    );

    // 2. Adjust course totals based on attendance status:
    // - 'present': increments held and attended
    // - 'absent': increments held
    // - 'excused' / 'cancelled': recorded in logs, but excuses the student without lowering percentage
    const isPresent = status === 'present';
    const isCounted = status === 'present' || status === 'absent';
    const heldIncrement = isCounted ? 1 : 0;
    const attendedIncrement = isPresent ? 1 : 0;

    let courseRow;
    if (heldIncrement > 0) {
      const courseRes = await client.query(
        `UPDATE courses
         SET total_classes_held = total_classes_held + $1,
             attended_classes = attended_classes + $2
         WHERE id = $3 AND user_id = $4
         RETURNING id, code, name, total_classes_held as "totalClasses", attended_classes as "attendedClasses";`,
        [heldIncrement, attendedIncrement, courseId, effectiveUserId]
      );
      courseRow = courseRes.rows[0];
    } else {
      const courseRes = await client.query(
        `SELECT id, code, name, total_classes_held as "totalClasses", attended_classes as "attendedClasses"
         FROM courses WHERE id = $1 AND user_id = $2;`,
        [courseId, effectiveUserId]
      );
      courseRow = courseRes.rows[0];
    }

    await client.query('COMMIT');
    res.status(201).json({
      record: attRes.rows[0],
      updatedCourse: courseRow,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Delete Specific Attendance Record (e.g. from history view)
app.delete('/api/attendance/:id', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const recRes = await client.query(
      `SELECT id, user_id, course_id, status FROM attendance_records WHERE id = $1;`,
      [id]
    );

    if (recRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Attendance record not found.' });
    }

    const rec = recRes.rows[0];
    if (req.user.id !== rec.user_id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }

    await client.query('DELETE FROM attendance_records WHERE id = $1;', [id]);

    const isPresent = rec.status === 'present';
    const isCounted = rec.status === 'present' || rec.status === 'absent';
    const heldDecrement = isCounted ? 1 : 0;
    const attendedDecrement = isPresent ? 1 : 0;

    let courseRow;
    if (heldDecrement > 0) {
      const courseRes = await client.query(
        `UPDATE courses
         SET total_classes_held = GREATEST(0, total_classes_held - $1),
             attended_classes = GREATEST(0, attended_classes - $2)
         WHERE id = $3 AND user_id = $4
         RETURNING id, code, name, total_classes_held as "totalClasses", attended_classes as "attendedClasses";`,
        [heldDecrement, attendedDecrement, rec.course_id, req.user.id]
      );
      courseRow = courseRes.rows[0];
    } else {
      const courseRes = await client.query(
        `SELECT id, code, name, total_classes_held as "totalClasses", attended_classes as "attendedClasses"
         FROM courses WHERE id = $1 AND user_id = $2;`,
        [rec.course_id, req.user.id]
      );
      courseRow = courseRes.rows[0];
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      deletedRecordId: id,
      updatedCourse: courseRow,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Undo Attendance (Atomic Transaction & Accurate Reversion)
app.post('/api/attendance/undo', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId, courseId } = req.body;
    const effectiveUserId = req.user.id || userId;
    await client.query('BEGIN');

    // 1. Find the latest attendance record for this course
    const latestRec = await client.query(
      `SELECT id, status FROM attendance_records
       WHERE user_id = $1 AND course_id = $2
       ORDER BY created_at DESC LIMIT 1;`,
      [effectiveUserId, courseId]
    );

    let wasPresent = false;
    let wasCounted = false;
    let deletedRecordId = null;

    if (latestRec.rows.length > 0) {
      const rec = latestRec.rows[0];
      wasPresent = rec.status === 'present';
      wasCounted = rec.status === 'present' || rec.status === 'absent';
      deletedRecordId = rec.id;
      await client.query('DELETE FROM attendance_records WHERE id = $1;', [rec.id]);
    } else {
      // Fallback: If no records exist, assume class was present if attendedClasses > 0
      const currCourse = await client.query('SELECT total_classes_held, attended_classes FROM courses WHERE id = $1 AND user_id = $2;', [courseId, effectiveUserId]);
      if (currCourse.rows.length > 0 && currCourse.rows[0].attended_classes > 0) {
        wasPresent = true;
        wasCounted = true;
      }
    }

    const attendedDecrement = wasPresent ? 1 : 0;
    const heldDecrement = wasCounted ? 1 : 0;

    const courseRes = await client.query(
      `UPDATE courses
       SET total_classes_held = GREATEST(0, total_classes_held - $1),
           attended_classes = GREATEST(0, attended_classes - $2)
       WHERE id = $3 AND user_id = $4
       RETURNING id, code, name, total_classes_held as "totalClasses", attended_classes as "attendedClasses";`,
      [heldDecrement, attendedDecrement, courseId, effectiveUserId]
    );

    await client.query('COMMIT');
    res.json({
      deletedRecordId,
      updatedCourse: courseRes.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update User Profile (including collegeMinAttendance, personalGoalAttendance, and semesterStartDate)
app.put('/api/users/profile', requireAuth, async (req, res) => {
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

    // Enforce constraint: personalGoal >= collegeMin
    if (minAtt !== null && persGoal !== null && persGoal < minAtt) {
      persGoal = minAtt;
    }

    const result = await pool.query(
      `UPDATE users
       SET full_name = COALESCE($1, full_name),
           college_name = COALESCE($2, college_name),
           branch = COALESCE($3, branch),
           degree_type = COALESCE($4, degree_type),
           semester = COALESCE($5, semester),
           semester_start_date = COALESCE($6, semester_start_date),
           college_min_attendance = COALESCE($7, college_min_attendance),
           personal_attendance_goal = COALESCE($8, personal_attendance_goal),
           target_attendance_percentage = COALESCE($7, target_attendance_percentage),
           theme_preference = COALESCE($9, theme_preference)
       WHERE id = $10
       RETURNING id, full_name as name, email, country, college_name as "collegeName", branch, degree_type as "degreeType", semester, total_semesters as "totalSemesters", TO_CHAR(semester_start_date, 'YYYY-MM-DD') as "semesterStartDate", college_min_attendance as "collegeMinAttendance", personal_attendance_goal as "personalGoalAttendance", theme_preference as theme;`,
      [name, collegeName, branch, degreeType, semester, semesterStartDate || null, minAtt, persGoal, theme, id]
    );

    const updated = result.rows[0];
    updated.collegeMinAttendance = Number(updated.collegeMinAttendance || 75);
    updated.personalGoalAttendance = Number(updated.personalGoalAttendance || updated.collegeMinAttendance);
    updated.targetAttendance = updated.collegeMinAttendance;

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear / Wipe Student Data (Atomic Transaction)
app.post('/api/data/wipe', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId } = req.body;
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }
    await client.query('BEGIN');
    await client.query('DELETE FROM attendance_records WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE user_id = $1);', [userId]);
    await client.query('DELETE FROM tasks WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM time_slots WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM courses WHERE user_id = $1;', [userId]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'All student data cleared successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Delete Student Account & All Data (Atomic Transaction)
app.delete('/api/users/:id', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    if (req.user.id !== id) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own account.' });
    }
    await client.query('BEGIN');
    await client.query('DELETE FROM attendance_records WHERE user_id = $1;', [id]);
    await client.query('DELETE FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE user_id = $1);', [id]);
    await client.query('DELETE FROM tasks WHERE user_id = $1;', [id]);
    await client.query('DELETE FROM time_slots WHERE user_id = $1;', [id]);
    await client.query('DELETE FROM courses WHERE user_id = $1;', [id]);
    await client.query('DELETE FROM users WHERE id = $1;', [id]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Student account and all associated data permanently deleted.' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Restore Student Data Backup to PostgreSQL (Atomic Transaction)
app.post('/api/data/restore', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId, data } = req.body;
    if (req.user.id !== userId) {
      return res.status(403).json({ error: 'Forbidden: Access denied.' });
    }
    if (!userId || !data) {
      return res.status(400).json({ error: 'User ID and backup data are required.' });
    }

    await client.query('BEGIN');

    // 1. Clear existing data
    await client.query('DELETE FROM attendance_records WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM subtasks WHERE task_id IN (SELECT id FROM tasks WHERE user_id = $1);', [userId]);
    await client.query('DELETE FROM tasks WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM time_slots WHERE user_id = $1;', [userId]);
    await client.query('DELETE FROM courses WHERE user_id = $1;', [userId]);

    // 2. Insert courses & track oldId -> newId mapping if needed
    const courseIdMap = new Map();
    if (Array.isArray(data.courses)) {
      for (const c of data.courses) {
        const ins = await client.query(
          `INSERT INTO courses (user_id, code, name, professor, default_room, color_hex, credits, attendance_goal, total_classes_held, attended_classes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id;`,
          [
            userId,
            c.code,
            c.name,
            c.professor || null,
            c.defaultRoom || null,
            c.color || '#3b82f6',
            c.credits || 3,
            c.attendanceGoal || 75,
            c.totalClasses || 0,
            c.attendedClasses || 0,
          ]
        );
        courseIdMap.set(c.id, ins.rows[0].id);
      }
    }

    // 3. Insert Time Slots
    if (Array.isArray(data.timeSlots)) {
      for (const s of data.timeSlots) {
        const courseId = courseIdMap.get(s.courseId) || s.courseId;
        await client.query(
          `INSERT INTO time_slots (user_id, course_id, day_of_week, start_time, end_time, room, slot_type, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
          [
            userId,
            courseId,
            s.day,
            s.startTime,
            s.endTime,
            s.room || null,
            s.type || 'Lecture',
            s.notes || null,
          ]
        );
      }
    }

    // 4. Insert Tasks & Subtasks
    if (Array.isArray(data.tasks)) {
      for (const t of data.tasks) {
        const courseId = t.courseId ? (courseIdMap.get(t.courseId) || t.courseId) : null;
        const taskRes = await client.query(
          `INSERT INTO tasks (user_id, course_id, title, description, due_date, due_time, priority, status, category)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id;`,
          [
            userId,
            courseId,
            t.title,
            t.description || null,
            t.dueDate || new Date().toISOString().split('T')[0],
            t.dueTime || '23:59:00',
            t.priority || 'medium',
            t.status || 'todo',
            t.category || 'assignment',
          ]
        );

        if (Array.isArray(t.subtasks) && t.subtasks.length > 0) {
          for (let i = 0; i < t.subtasks.length; i++) {
            const st = t.subtasks[i];
            await client.query(
              `INSERT INTO subtasks (task_id, title, is_completed, sort_order)
               VALUES ($1, $2, $3, $4);`,
              [taskRes.rows[0].id, st.title, st.completed || false, i]
            );
          }
        }
      }
    }

    // 5. Insert Attendance Records
    if (Array.isArray(data.attendanceRecords)) {
      for (const a of data.attendanceRecords) {
        const courseId = courseIdMap.get(a.courseId) || a.courseId;
        await client.query(
          `INSERT INTO attendance_records (user_id, course_id, log_date, status, note)
           VALUES ($1, $2, $3, $4, $5);`,
          [userId, courseId, a.date || null, a.status || 'present', a.note || null]
        );
      }
    }

    await client.query('COMMIT');
    const fullData = await fetchFullStudentData(userId, data.theme || 'dark-slate');
    res.json({ success: true, data: fullData });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Data Restore Error:', err);
    res.status(500).json({ error: 'Failed to restore student backup: ' + err.message });
  } finally {
    client.release();
  }
});

// Serve Vite production build if dist directory exists
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

app.listen(PORT, () => {
  console.log(`🚀 AcademiaSync Server running on http://localhost:${PORT}`);
});
