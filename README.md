# 🎓 AcademiaSync — Modern College Timetable & Task Manager

A high-performance, aesthetic web application built for college students to manage daily lectures, assignment deadlines, attendance criteria, and exam preparation.

---

## ✨ Key Features

1. **⚡ Live Lecture Ticker & Countdown**:
   - Real-time indicator for the ongoing class with progress bar and countdown timer.
   - "Up Next" preview showing room number, professor, and minutes until start.
   - 1-tap "Mark Present" / "Missed / Bunk" directly from the dashboard.

2. **🗓️ Interactive Timetable Matrix**:
   - **Daily Agenda View**: Step-by-step lecture cards with room, professor, and lecture type.
   - **Weekly Matrix View**: Visual multi-column grid across the entire academic week.
   - Add/Edit/Delete class slots with custom colors, rooms, and notes.

3. **📊 College Attendance & Safe Bunk Engine**:
   - Real-time attendance percentage meter per course.
   - **Safe Bunk Calculator**: Tells you exactly how many classes you can safely skip without dropping below your target percentage (e.g. 75%).
   - **Recovery Calculator**: Shows the exact number of consecutive classes required to reach your target if you have an attendance shortage.

4. **📋 Assignment & Exam Kanban Board**:
   - Kanban columns (**To Do**, **In Progress**, **Completed**).
   - Priority tags (🔥 Urgent, ⚠️ High, Medium, Low) and category filters.
   - Interactive subtasks checklist with progress bars and celebration confetti!

5. **⏳ Exam & Viva Countdown Hub**:
   - Live ticking Days, Hours, Minutes, and Seconds countdowns for Midterms and Finals.
   - Syllabus topic revision checklist.

6. **🎨 Aesthetic Themes**:
   - Dark Slate Pro 🌙
   - Midnight OLED ✨
   - Cyberpunk Neon ⚡
   - Emerald Matrix 🌲
   - Sunset Amber 🌅
   - Clean Minimalist ☀️

7. **📅 Calendar Sync & Export**:
   - 1-Click Export to Apple Calendar / Google Calendar / Outlook (`.ics`).
   - Export Tasks & Deadlines to `.ics`.
   - Print-ready PDF stylesheet.
   - Offline JSON backup and restore.

---

## 🚀 Getting Started

### 1. Install & Run Locally
```bash
# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

### 2. Build for Production
```bash
npm run build
```

---

## 🐘 PostgreSQL Database Integration

The project includes a production-ready PostgreSQL schema in [`schema.sql`](./schema.sql).

### To connect to PostgreSQL (Supabase, Neon, AWS RDS, Docker):
1. Create a new PostgreSQL database on [Supabase](https://supabase.com) or [Neon](https://neon.tech) (or run a local Docker PostgreSQL container: `docker run --name pg-campus -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres`).
2. Open the SQL Editor in your database dashboard and paste the contents of [`schema.sql`](./schema.sql).
3. The schema creates all tables (`users`, `courses`, `time_slots`, `tasks`, `subtasks`, `attendance_records`) and analytic views (`view_course_attendance_analytics`) with automated timestamp triggers.
