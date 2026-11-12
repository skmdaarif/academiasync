# 🎓 AcademiaSync (v2.1.0)

> **Complete University Timetable, Safe-Bunk Attendance Engine, Day Order Swaps & Academic Productivity Suite**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Express](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-3.46+-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org)

---

## 📖 Overview

**AcademiaSync** is a full-stack, local-first academic operating system engineered specifically for college and university students. It combines real-time class tracking, automated timetable PDF scanning, an intelligent attendance engine with **Safe Bunk Capacity** and **Shortage Recovery**, institutional **Day Order Swaps** (compensatory days), university **On-Duty (OD) / Excused credit policies**, assignment Kanban boards with LMS submission links, multi-semester transcript vaulting, and native calendar export (`.ics` / Google Calendar / Apple Calendar).

Running on a **zero-configuration embedded SQLite engine** (`better-sqlite3`), you can clone and run AcademiaSync on a personal laptop without setting up external database servers, containers, or third-party cloud accounts.

---

## 🖥️ Setup Guide

Follow the instructions below for your operating system (Windows, macOS, or Linux). This guide covers everything from a brand-new, freshly installed system to running the application.

---

### 🪟 Windows (Windows 10 / 11)

On a freshly installed Windows machine, no developer tools are pre-installed. You can install everything via the terminal or with visual graphical installers:

#### Option A: Fast Setup via Windows Terminal / PowerShell (Recommended)
1. Press `Win + X` and select **Terminal** (or **PowerShell**).
2. Install **Git** and **Node.js LTS** using the built-in Windows Package Manager (`winget`):
   ```powershell
   winget install --id Git.Git -e --source winget
   winget install --id OpenJS.NodeJS.LTS -e --source winget
   ```
3. **Close and reopen PowerShell** so your system recognizes the newly installed `git` and `node` commands.
4. Verify the installations:
   ```powershell
   node -v
   npm -v
   git --version
   ```

#### Option B: Setup via Official Web Installers
1. **Install Git**: Download the 64-bit installer from [git-scm.com/download/win](https://git-scm.com/download/win). Follow the setup wizard (default options are recommended).
2. **Install Node.js**: Download the **LTS (Long Term Support)** installer from [nodejs.org](https://nodejs.org). Run the `.msi` installer. On the *"Tools for Native Modules"* screen, ensure the box to install Python/build tools is checked.
3. Open **Command Prompt** or **PowerShell** and verify with `node -v` and `git --version`.

---

### 🍎 macOS (Apple Silicon M1/M2/M3/M4 or Intel)

On a freshly installed Mac:

1. Open **Terminal** (Press `Cmd + Space`, type `Terminal`, and press `Enter`).
2. Install **Apple Command Line Tools** (provides Git, C++, and build compilers):
   ```bash
   xcode-select --install
   ```
   *A software update popup will appear—click **Install** and wait for it to complete.*

3. Install **Node.js LTS**:
   - **Via Official Package**: Download and run the macOS `.pkg` installer from [nodejs.org](https://nodejs.org).
   - **Via Homebrew** (alternative):
     ```bash
     # Install Homebrew if you don't have it
     /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
     
     # Install Node.js
     brew install node
     ```
4. Verify the installation:
   ```bash
   node -v
   npm -v
   git --version
   ```

---

### 🐧 Linux (Ubuntu / Debian / Fedora / Arch)

On a fresh Linux installation, open a terminal window:

#### Ubuntu / Debian / Linux Mint:
```bash
# 1. Update repository indices and install standard build tools & git
sudo apt update
sudo apt install -y curl git build-essential python3

# 2. Install Node.js LTS (v20 or v22) via official NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Verify versions
node -v
npm -v
git --version
```

#### Fedora / RHEL:
```bash
sudo dnf install -y git gcc gcc-c++ make python3 nodejs
```

#### Arch Linux:
```bash
sudo pacman -Syu --noconfirm git base-devel nodejs npm
```

---

## 🚀 Running AcademiaSync

Once Git and Node.js are installed on your system:

### Step 1: Get the Code

#### Using Git (Terminal):
```bash
git clone https://github.com/skmdaarif/academiasync.git
cd academiasync
```

#### Without Git (Download ZIP):
1. Click the green **Code** button at the top of the GitHub repository page.
2. Click **Download ZIP**.
3. Extract the ZIP file into a folder on your computer (e.g. `Downloads/academiasync` or `Desktop/academiasync`).
4. Open your terminal / Command Prompt inside that extracted folder.

---

### Step 2: Install Project Dependencies
Run the following command in the project folder:
```bash
npm install
```
> [!NOTE]
> This command downloads all required frontend packages (React 19, Vite, Tailwind CSS v4, Lucide icons) and backend modules (`better-sqlite3`, Express).

---

### Step 3: Launch the Development Server
```bash
npm run dev
```

This single command starts both:
- **Backend API Server**: Runs on `http://localhost:5001` with the local SQLite database.
- **Frontend Web Client**: Runs on `http://localhost:5173` with instant Hot Module Replacement (HMR).

---

### Step 4: Open in Your Browser
Open your browser and navigate to:
```
http://localhost:5173
```

- **Instant Demo**: Click **"🚀 Try Demo Schedule"** on the welcome screen to test drive a pre-populated semester with attendance records, timetable slots, assignments, and exams.
- **Your Own Profile**: Click **"Create Profile"** to select your university, branch, degree, current semester, and semester start date.

---

## 🏗️ Production Build & Local Single-Port Server

To create an optimized production build and serve the application and REST API together on a single port:

```bash
# Build the production frontend bundle
npm run build

# Start the full-stack server
npm start
```
The application will be live at **`http://localhost:5001`**.

---

## ✨ Key Features in v2.1.0

### 1. 🔄 Day Order Swaps & Schedule Overrides
- **Institutional Compensation Days**: Easily switch schedules when your college declares a weekend or holiday as a working day following another day's timetable (e.g. *"Running Tuesday's schedule on Saturday"*).
- Configure overrides directly from the **Timetable Grid** using the **"Day Swap"** tool.
- The **Live Lecture Hero** and **Daily Agenda** immediately adapt to the swapped day's classes while preserving the true calendar date.

### 2. ⚪ 3-Way Class Marking & Zero-Penalty Logging
- Mark classes as **Present**, **Missed / Absent**, or **⚪ Not Conducted**.
- **Not Conducted** handles sudden half-days, professor absences, strikes, or holidays—logging the event without reducing your safe bunk count or penalizing your percentage.

### 3. ⚖️ Institutional OD / Excused Attendance Policies
Configure how your university handles On-Duty (OD) / Medical Leave in **Profile Settings**:
- **Exemption Mode** (UGC Standard): Excused classes are omitted from total lectures held, preventing penalties.
- **Full Credit Mode** (SRM / Manipal / Amity): Excused classes count as both held and attended, boosting attendance.

### 4. 🧮 Interactive "What-If" Bunk Simulator
- Built into each course card in the **Attendance Calculator**.
- Drag the **What-If Slider** (0 to 10 future absences) to preview exact percentage drops and see the exact number of consecutive classes required to recover to your target.

### 5. 🎯 Semester Start Date Calibration & Countdown
- Set your official semester start date during registration or in Settings.
- If classes have not yet begun, the dashboard displays a live **`Classes Start in X Days`** countdown.

### 6. 📝 Expanded Assessment Taxonomy
- Schedule and track all university evaluation formats:
  - **MTT** (Mid-Term Test)
  - **ETT** (End-Term Theory)
  - **CA** (Continuous Assessment / Internal Tests)
  - **Quiz** (Surprise & Scheduled Quizzes)
  - **Project** (Jury / Capstone Milestone)
  - **Viva** (Oral / Practical Examination)
  - **Backlog** (Re-sit / Improvement Exam)
- Track syllabus unit completion, exam rooms, seat numbers, and sessions (Morning / Evening).

### 7. 🔗 Direct LMS Submission Shortcuts
- Attach assignment submission portal links (Moodle, Blackboard, Google Classroom, Canvas, or Google Drive) directly to tasks.
- Launch your submission page in 1-click using the **`🔗 Submit on LMS`** button on task cards.

### 8. 🏛️ Multi-Semester History & Academic Vault
- Complete multi-semester transcript preservation—previous semesters are never overwritten.
- Store official marksheet PDF / Google Drive links for verified grade records.
- Track lifetime degree metrics: **Cumulative GPA (CGPA)**, **Total Credits Earned**, and **Average Attendance**.

### 9. 📑 1-Click Timetable PDF Scanner
- Upload your college schedule PDF (such as university ERP exports) to extract courses, faculty names, room numbers, and weekly slots in seconds using client-side `pdfjs-dist`.

### 10. 🔒 10-Minute Campus Security Auto-Logout
- Built-in inactivity watchdog protects your account if left unattended on public campus library or laboratory computers.

---

## 🖥️ Universal Desktop App (Tauri v2)

AcademiaSync is also packaged as a native desktop application powered by [Tauri v2](https://v2.tauri.app):

```bash
# Run the native desktop app in development
npm run desktop:dev

# Build standalone native installers (.dmg on macOS, .exe on Windows, .deb on Linux)
npm run desktop:build
```
- Consumes under 30MB of RAM.
- Integrated system tray icon and menu bar widget.
- Native desktop notifications before upcoming lectures.

---

## 🔧 Common Troubleshooting (Fresh OS)

### 1. `command not found: node` or `'node' is not recognized`
- **Cause**: Node.js was just installed, but the open terminal has not refreshed its environment variables.
- **Solution**: Completely close and re-open your terminal or command prompt. On Windows, verify that *"Add to PATH"* was selected during Node.js installation.

### 2. Native Compilation Error during `npm install` (`better-sqlite3`)
- **Cause**: Missing C/C++ compiler toolchain required to compile native database bindings.
- **Solutions**:
  - **Windows**: Run `npm install --global windows-build-tools` or install the C++ Desktop workload from Visual Studio Community Installer.
  - **macOS**: Run `xcode-select --install` in Terminal.
  - **Linux**: Run `sudo apt install build-essential python3` (Debian/Ubuntu) or `sudo dnf install gcc gcc-c++ make python3` (Fedora).

### 3. Port `5001` or `5173` Already in Use
- **Cause**: Another service or an earlier instance of AcademiaSync is occupying the port.
- **Solution**:
  - Stop any existing Node processes:
    - **macOS / Linux**: `killall node` or `lsof -ti:5001 | xargs kill -9`
    - **Windows**: `taskkill /F /IM node.exe`

---

## 📡 REST API Quick Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | SQLite database connection status & mode |
| `POST` | `/api/auth/register` | Register student profile with start date and OD policy |
| `POST` | `/api/auth/login` | Authenticate student and load credentials |
| `GET` | `/api/data/:userId` | Retrieve complete student profile, schedule, and vault |
| `POST` | `/api/courses` | Create course with credit hours & baseline calibration |
| `POST` | `/api/slots` | Add weekly timetable slot |
| `POST` | `/api/attendance` | Record class status (`present`, `absent`, `cancelled`) |
| `POST` | `/api/schedule-overrides` | Set day order override (e.g. running Tuesday on Saturday) |
| `DELETE` | `/api/schedule-overrides/:id` | Remove a schedule override |
| `POST` | `/api/exams` | Add exam with syllabus checklists and room details |
| `POST` | `/api/tasks` | Create task with optional LMS submission link |

---

## 🤝 Contributing

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'feat: Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for details.

<p align="center">
  Crafted with ❤️ for students worldwide.
</p>