import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const app = express();
const PORT = process.env.PORT || 5001;

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

app.use(cors());
app.use(express.json());

// Health Check
app.get('/api/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT current_database(), current_user, NOW() as current_time;');
    res.json({ status: 'ok', database: dbRes.rows[0] });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
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

    res.status(201).json({
      success: true,
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

    res.json({
      success: true,
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
app.get('/api/data/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const userRes = await pool.query('SELECT theme_preference FROM users WHERE id = $1;', [userId]);
    const theme = userRes.rows[0]?.theme_preference || 'dark-slate';
    const data = await fetchFullStudentData(userId, theme);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Course (with optional initial mid-semester attendance)
app.post('/api/courses', async (req, res) => {
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

    const totalHeld = Math.max(0, parseInt(totalClasses, 10) || 0);
    const attended = Math.min(totalHeld, Math.max(0, parseInt(attendedClasses, 10) || 0));

    const result = await pool.query(
      `INSERT INTO courses (user_id, code, name, professor, default_room, color_hex, credits, attendance_goal, total_classes_held, attended_classes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, code, name, professor, default_room as "defaultRoom", color_hex as color, credits, attendance_goal as "attendanceGoal", total_classes_held as "totalClasses", attended_classes as "attendedClasses";`,
      [userId, code, name, professor || null, defaultRoom || null, color || '#3b82f6', credits || 3, attendanceGoal || 75, totalHeld, attended]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Course
app.put('/api/courses/:id', async (req, res) => {
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
       WHERE id = $10
       RETURNING id, code, name, professor, default_room as "defaultRoom", color_hex as color, credits, attendance_goal as "attendanceGoal", total_classes_held as "totalClasses", attended_classes as "attendedClasses";`,
      [code, name, professor, defaultRoom, color, credits, attendanceGoal, totalClasses, attendedClasses, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Course
app.delete('/api/courses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM courses WHERE id = $1;', [id]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Time Slot
app.post('/api/slots', async (req, res) => {
  try {
    const { userId, courseId, day, startTime, endTime, room, type, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO time_slots (user_id, course_id, day_of_week, start_time, end_time, room, slot_type, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, course_id as "courseId", day_of_week as day, TO_CHAR(start_time, 'HH24:MI') as "startTime", TO_CHAR(end_time, 'HH24:MI') as "endTime", room, slot_type as type, notes;`,
      [userId, courseId, day, startTime, endTime, room || null, type || 'Lecture', notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Time Slot
app.delete('/api/slots/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM time_slots WHERE id = $1;', [id]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add Task
app.post('/api/tasks', async (req, res) => {
  try {
    const { userId, courseId, title, description, dueDate, dueTime, priority, status, category, subtasks } = req.body;
    
    const taskRes = await pool.query(
      `INSERT INTO tasks (user_id, course_id, title, description, due_date, due_time, priority, status, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, course_id as "courseId", title, description, TO_CHAR(due_date, 'YYYY-MM-DD') as "dueDate", TO_CHAR(due_time, 'HH24:MI') as "dueTime", priority, status, category, TO_CHAR(created_at, 'YYYY-MM-DD') as "createdAt";`,
      [userId, courseId || null, title, description || null, dueDate, dueTime || '23:59:00', priority || 'medium', status || 'todo', category || 'assignment']
    );

    const task = taskRes.rows[0];
    const createdSubtasks = [];

    if (Array.isArray(subtasks) && subtasks.length > 0) {
      for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i];
        const stRes = await pool.query(
          `INSERT INTO subtasks (task_id, title, is_completed, sort_order)
           VALUES ($1, $2, $3, $4)
           RETURNING id, title, is_completed as completed;`,
          [task.id, st.title, st.completed || false, i]
        );
        createdSubtasks.push(stRes.rows[0]);
      }
    }

    task.subtasks = createdSubtasks;
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Task
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, dueDate, dueTime, priority, status, category, subtasks } = req.body;

    const taskRes = await pool.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           description = $2,
           due_date = COALESCE($3, due_date),
           due_time = COALESCE($4, due_time),
           priority = COALESCE($5, priority),
           status = COALESCE($6, status),
           category = COALESCE($7, category)
       WHERE id = $8
       RETURNING id, course_id as "courseId", title, description, TO_CHAR(due_date, 'YYYY-MM-DD') as "dueDate", TO_CHAR(due_time, 'HH24:MI') as "dueTime", priority, status, category;`,
      [title, description, dueDate, dueTime, priority, status, category, id]
    );

    if (Array.isArray(subtasks)) {
      await pool.query('DELETE FROM subtasks WHERE task_id = $1;', [id]);
      for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i];
        await pool.query(
          `INSERT INTO subtasks (task_id, title, is_completed, sort_order)
           VALUES ($1, $2, $3, $4);`,
          [id, st.title, st.completed || false, i]
        );
      }
    }

    const updatedTask = taskRes.rows[0];
    const currentSubtasks = await pool.query('SELECT id, title, is_completed as completed FROM subtasks WHERE task_id = $1 ORDER BY sort_order ASC;', [id]);
    updatedTask.subtasks = currentSubtasks.rows;

    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Task
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM tasks WHERE id = $1;', [id]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Log Attendance
app.post('/api/attendance', async (req, res) => {
  try {
    const { userId, courseId, status, date, note } = req.body;
    
    // 1. Insert record
    const attRes = await pool.query(
      `INSERT INTO attendance_records (user_id, course_id, log_date, status, note)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5)
       RETURNING id, course_id as "courseId", TO_CHAR(log_date, 'YYYY-MM-DD') as date, status, note;`,
      [userId, courseId, date || null, status, note || null]
    );

    // 2. Increment course totals
    const attendedIncrement = status === 'present' ? 1 : 0;
    const courseRes = await pool.query(
      `UPDATE courses
       SET total_classes_held = total_classes_held + 1,
           attended_classes = attended_classes + $1
       WHERE id = $2
       RETURNING id, code, name, total_classes_held as "totalClasses", attended_classes as "attendedClasses";`,
      [attendedIncrement, courseId]
    );

    res.status(201).json({
      record: attRes.rows[0],
      updatedCourse: courseRes.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update User Profile (including collegeMinAttendance, personalGoalAttendance, and semesterStartDate)
app.put('/api/users/profile', async (req, res) => {
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

// Clear / Wipe Student Data
app.post('/api/data/wipe', async (req, res) => {
  try {
    const { userId } = req.body;
    await pool.query('DELETE FROM attendance_records WHERE user_id = $1;', [userId]);
    await pool.query('DELETE FROM tasks WHERE user_id = $1;', [userId]);
    await pool.query('DELETE FROM time_slots WHERE user_id = $1;', [userId]);
    await pool.query('DELETE FROM courses WHERE user_id = $1;', [userId]);
    res.json({ success: true, message: 'All student data cleared successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 PostgreSQL Backend Server running on http://localhost:${PORT}`);
  console.log(`🐘 Connected directly to local PostgreSQL database 'academiasync'`);
});
