# 🎓 AcademiaSync

> **Modern College Timetable, Safe-Bunk Attendance Engine & Task Management Hub**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Express](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-3.46+-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org)

---

## 📖 Overview

**AcademiaSync** is a full-stack, local-first academic productivity suite built specifically for university and college students. It pairs real-time class schedule management with an intelligent attendance simulation engine that calculates **safe bunk capacity** and **shortage recovery**, an assignment Kanban board with subtask tracking, exam countdowns, retroactive attendance history logs, and cross-platform calendar synchronization (`.ics` / Google Calendar / Apple Calendar / Outlook).

Running on a **zero-config embedded SQLite engine** (`better-sqlite3`), any student can clone and start using AcademiaSync in seconds on their personal laptop without needing Docker, database servers, or internet access.

---

## ✨ Key Features

### ⚡ 1. Live Lecture Ticker & Real-Time Status
- **Real-Time Dynamic Indicator**: Continuously computes ongoing lecture status based on system time and current day.
- **Progress Bar & Countdown**: Visual progress bar tracking elapsed lecture minutes and countdown to period end.
- **"Up Next" Preview**: Displays next classroom, professor, and countdown before the next session begins.
- **1-Tap Attendance**: Log *Present* or *Missed / Bunk* directly from the hero header with instant database updates.

### 🗓️ 2. Dual-View Timetable Matrix
- **Daily Agenda View**: Chronological lecture timeline with room numbers, instructors, course tags, and meeting links.
- **Weekly Matrix View**: 7-day multi-column interactive schedule with visual color-coding and overlap detection.
- **Slot Management**: Create, edit, and categorize slots (*Lecture*, *Lab*, *Tutorial*, *Seminar*, *Club / Activity*).

### 📊 3. Attendance & "Safe Bunk" Engine
- **Attendance Percentage Meter**: Visual circular gauge tracking current attendance against university minimums (e.g., 75%) or personal targets.
- **Safe Bunk Calculator**: Calculates the exact number of consecutive lectures you can safely skip without dropping below your target percentage:
  $$\text{Safe Bunks} = \left\lfloor \frac{\text{Attended} - (\text{Target} \times \text{Total})}{1 - \text{Target}} \right\rfloor$$
- **Shortage Recovery Calculator**: If you drop below the required percentage, instantly calculates the consecutive classes you must attend to recover:
  $$\text{Classes Needed} = \left\lceil \frac{(\text{Target} \times \text{Total}) - \text{Attended}}{1 - \text{Target}} \right\rceil$$

### 📋 4. Assignment & Exam Kanban Board
- **Three-Column Workflow**: Drag-and-drop or status-toggle tasks across **To Do**, **In Progress**, and **Completed**.
- **Priority & Categorization**: Mark tasks as *Urgent* 🔥, *High* ⚠️, *Medium*, or *Low*, categorized by *Assignment*, *Exam*, *Project*, *Quiz*, or *Personal*.
- **Interactive Subtasks**: Track granular deliverables with checklists, progress percentages, and confetti celebrations upon completion.

### ⏳ 5. Exam & Viva Countdown Hub
- Live countdown ticker (Days, Hours, Minutes, Seconds) for Midterms, Lab Vivas, and End-Semester Finals.
- Built-in syllabus module checklist for systematic topic-by-topic revision tracking.

### 🎨 6. Six Aesthetic Built-in Themes
Switch effortlessly between bespoke color palettes with smooth transitions:
- 🌙 **Dark Slate Pro** (Default modern dark mode)
- ✨ **Midnight OLED** (True-black contrast for OLED displays)
- ⚡ **Cyberpunk Neon** (Vibrant high-contrast accents)
- 🌲 **Emerald Forest** (Soothing deep green & mint tones)
- 🌅 **Sunset Amber** (Warm twilight hues)
- ☀️ **Clean Minimalist** (Crisp high-readability light theme)

### 📅 7. Calendar Export & Offline Portability
- **iCalendar (`.ics`) Sync**: 1-click export of recurring weekly timetable schedules and assignment deadlines directly into Google Calendar, Apple Calendar, or Microsoft Outlook.
- **Print / PDF Sheet**: Formats clean, print-ready schedule overviews using `jspdf` and `html2canvas`.
- **JSON Backup & Restore**: Download encrypted offline JSON snapshots and restore state anytime.

### 📑 8. 1-Click Timetable PDF Scanner & Auto-Populator
- **Automatic PDF Schedule Ingestion**: Upload an official university or college schedule PDF (e.g. LPU or university ERP exports) to populate all courses and weekly timetable slots in under 2 seconds.
- **Intelligent Entity Extraction**:
  - Course Catalog: Course codes, full titles, credits, faculty names, and default lecture rooms.
  - Weekly Matrix: Monday through Sunday periods, start/end times in 24h format, and classroom numbers.
  - Student Profile: Auto-detects student registration VID and home section.
- **Lab Batch Group Filtering**: Lets students choose their assigned lab group (e.g., `Group 1`, `Group 2`, or `All`) to automatically exclude other batches' practical sessions.
- **100% Private & Local**: Client-side parsing using Mozilla `pdfjs-dist` with zero external cloud APIs or data transmission.

---

## 🛠️ Tech Stack

| Category | Technology | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | [React 19](https://react.dev) | High-performance reactive UI with concurrency |
| **Language** | [TypeScript 6](https://www.typescriptlang.org) | End-to-end type safety |
| **Build Tool** | [Vite 8](https://vite.dev) | Ultra-fast HMR and bundle optimization |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com) | Modern utility-first CSS design system |
| **Icons** | [Lucide React](https://lucide.dev) | Comprehensive, clean icon set |
| **Backend** | [Express 5](https://expressjs.com) | Node.js REST API with modular routing |
| **Database** | [SQLite 3 (better-sqlite3)](https://www.sqlite.org) | Embedded zero-config local database with WAL mode & atomic transactions |
| **PDF Processing** | [PDF.js (pdfjs-dist)](https://mozilla.github.io/pdf.js/) | Fast client-side timetable extraction & spatial grid parsing |
| **Security** | [BcryptJS](https://www.npmjs.com/package/bcryptjs) | Password hashing with salt generation |
| **Utilities** | `date-fns`, `canvas-confetti`, `jspdf` | Date math, celebratory UI, and document generation |

---

## 📁 Project Structure

```
├── server.js               # Express REST API & PostgreSQL connection pool
├── schema.sql              # Database DDL (tables, ENUMs, indices, triggers)
├── seed.sql                # Starter sample data for quick testing
├── vite.config.ts          # Vite configuration with API reverse proxy
├── tsconfig.json           # TypeScript configuration
├── package.json            # Scripts & project dependencies
├── .env.example            # Environment variables template
├── public/                 # Static assets & icons
└── src/
    ├── App.tsx             # Master application state & auto-logout session logic
    ├── main.tsx            # React application entrypoint
    ├── components/
    │   ├── AddModal.tsx            # Create/edit dialog for courses, slots, and tasks
    │   ├── AttendanceCalculator.tsx# Attendance engine with Safe Bunk & Recovery
    │   ├── AuthScreen.tsx          # Student sign-up & login screens
    │   ├── EmptyState.tsx          # Informative placeholders for empty views
    │   ├── ExamCountdownHub.tsx    # Live exam countdowns and syllabus checklist
    │   ├── ExportModal.tsx         # iCal, PDF, and JSON data export modal
    │   ├── Header.tsx              # Navigation bar, view selector & theme switcher
    │   ├── LiveHero.tsx            # Current lecture ticker, countdown & quick actions
    │   ├── SettingsModal.tsx       # Student profile & attendance criteria settings
    │   ├── TaskManager.tsx         # Kanban assignment board with subtasks
    │   └── TimetableGrid.tsx       # Daily Agenda and 7-day Weekly Grid views
    ├── data/
    │   ├── degrees.ts              # Degree presets (B.Tech, B.Sc, M.Tech, etc.)
    │   └── universities.ts         # University listing for onboarding
    ├── services/
    │   ├── api.ts                  # REST API client fetch functions
    │   ├── auth.ts                 # Authentication utilities
    │   └── storage.ts              # JSON export & restore parsers
    ├── styles/
    │   └── themes.ts               # Theme definitions and color constants
    ├── types/
    │   └── index.ts                # TypeScript type definitions and interfaces
    └── utils/
        ├── calendarExport.ts       # RFC 5545 iCalendar generator & PDF exporter
        └── timeUtils.ts            # Time calculations, periods & day helpers
```

---

## 🚀 Getting Started (Zero Setup in 30 Seconds)

AcademiaSync runs on an **Embedded SQLite Engine** with browser offline fallback. Any student can clone and run it immediately on their laptop with **zero database installation, zero Docker, and zero server maintenance**:

```bash
# 1. Clone the repository
git clone https://github.com/skmdaarif/academiasync.git
cd academiasync

# 2. Install dependencies
npm install

# 3. Start the application
npm run dev
```

- Open **`http://localhost:5173`** in your browser.
- The server will automatically initialize `./data/academiasync.db` with all tables, constraints, and indexes.
- Click **"🚀 Try Demo Schedule"** on the welcome screen to test drive a preloaded college semester, or create your student profile. Everything saves automatically!

---

### Production Build & Single-Port Server

To build the client and serve everything from a single server port:

```bash
npm run build
npm start
```
The application and REST API are served together at `http://localhost:5001`.

---

## 🖥️ Universal Native Desktop App (Tauri v2)

AcademiaSync is also available as a **high-performance native desktop application** for macOS, Windows, and Linux, powered by [Tauri v2](https://v2.tauri.app) and sharing 100% of the React core and local SQLite database:

- **System Tray & Menu Bar Widget**: Resides in your OS menu bar / notification area for instant 1-click access to your daily classes.
- **Native OS Alarms & Notifications**: Triggers native desktop notification banners 10 minutes prior to lecture start times.
- **Ultra-Lightweight**: Uses the native OS webview engine, consuming under 30MB of RAM.

```bash
# Run the native desktop app in development
npm run desktop:dev

# Build native installers (.app and .dmg for macOS, .exe for Windows, .deb for Linux)
npm run desktop:build
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | SQLite database connection health check |
| `POST` | `/api/auth/register` | Register a new student profile |
| `POST` | `/api/auth/login` | Authenticate student and load credentials |
| `GET` | `/api/data/:userId` | Fetch full student payload (courses, slots, tasks, attendance) |
| `POST` | `/api/courses` | Add a new course/subject |
| `PUT` | `/api/courses/:id` | Update existing course details or goals |
| `DELETE` | `/api/courses/:id` | Delete a course and its associated slots |
| `POST` | `/api/slots` | Add a timetable class slot |
| `DELETE` | `/api/slots/:id` | Remove a timetable class slot |
| `POST` | `/api/tasks` | Create a new task/assignment |
| `PUT` | `/api/tasks/:id` | Update task status, priority, or subtasks |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `POST` | `/api/attendance` | Record an attendance event (`present`, `absent`, `cancelled`) |
| `PUT` | `/api/profile/:id` | Update user profile and target criteria |
| `POST` | `/api/reset/:id` | Wipe timetable data and reset back to clean state |

---

## 🔒 Security & Auto-Logout

AcademiaSync includes a built-in **10-minute inactivity watchdog** in [`src/App.tsx`](src/App.tsx). If no keyboard or mouse interactions are detected for 10 minutes, the session is cleared automatically from client storage to safeguard student privacy on shared campus library or lab computers.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for more information.

---

<p align="center">
  Crafted with ❤️ for students worldwide.
</p>
