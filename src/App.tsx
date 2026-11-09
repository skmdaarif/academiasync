import { useState, useEffect } from 'react';
import { 
  StudentData, 
  Course, 
  TimeSlot, 
  Task, 
  UserAccount, 
  ThemeKey, 
  AttendanceStatus 
} from './types';
import { 
  apiFetchStudentData, 
  apiAddCourse, 
  apiUpdateCourse, 
  apiDeleteCourse, 
  apiAddSlot, 
  apiUpdateSlot,
  apiDeleteSlot, 
  apiAddTask, 
  apiUpdateTask, 
  apiDeleteTask, 
  apiLogAttendance, 
  apiUndoAttendance,
  apiUpdateProfile, 
  apiWipeData,
  apiDeleteAccount 
} from './services/api';
import { THEMES } from './styles/themes';
import { AuthScreen } from './components/AuthScreen';
import { Header } from './components/Header';
import { LiveHero } from './components/LiveHero';
import { TimetableGrid } from './components/TimetableGrid';
import { TaskManager } from './components/TaskManager';
import { AttendanceCalculator } from './components/AttendanceCalculator';
import { ExamCountdownHub } from './components/ExamCountdownHub';
import { AddModal } from './components/AddModal';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { EmptyState } from './components/EmptyState';
import { getTodayDayName } from './utils/timeUtils';

const SESSION_KEY = 'academiasync_active_user_v3';
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export function App() {
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [state, setState] = useState<StudentData>({
    courses: [],
    timeSlots: [],
    tasks: [],
    attendanceRecords: [],
    theme: 'dark-slate',
    activeView: 'dashboard',
  });
  
  // Modals state
  const [addModalType, setAddModalType] = useState<'slot' | 'task' | 'course' | null>(null);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Sync active user to session
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(currentUser));
      // Load data from PostgreSQL
      apiFetchStudentData(currentUser.id)
        .then((data) => setState(data))
        .catch((err) => console.error('Failed to load Postgres student data:', err));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [currentUser?.id]);

  // 10-Minute Automatic Inactivity Logout (active on shared computers, disabled if staySignedIn is true)
  useEffect(() => {
    if (!currentUser || currentUser.staySignedIn) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        // Auto-logout after 10 minutes of inactivity
        setCurrentUser(null);
        setState({
          courses: [],
          timeSlots: [],
          tasks: [],
          attendanceRecords: [],
          theme: 'dark-slate',
          activeView: 'dashboard',
        });
        localStorage.removeItem(SESSION_KEY);
        setSessionExpiredNotice(true);
      }, INACTIVITY_TIMEOUT_MS);
    };

    // User activity listeners
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'keypress',
      'visibilitychange',
    ];

    resetTimer();

    const onUserActivity = () => {
      resetTimer();
    };

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, onUserActivity, { passive: true });
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, onUserActivity);
      });
    };
  }, [currentUser]);

  const currentTheme = THEMES[state.theme] || THEMES['dark-slate'];

  // Update Body style dynamically based on theme
  useEffect(() => {
    if (currentUser) {
      document.body.style.backgroundColor = currentTheme.bodyBg;
      document.body.style.backgroundImage = currentTheme.bgGradient;
    } else {
      document.body.style.backgroundColor = '#070b14';
      document.body.style.backgroundImage = 'none';
    }
  }, [state.theme, currentTheme, currentUser]);

  // If user is not logged in, render Authentication screen
  if (!currentUser) {
    return (
      <AuthScreen
        sessionExpiredNotice={sessionExpiredNotice}
        onAuthenticated={(user, data) => {
          setSessionExpiredNotice(false);
          setCurrentUser(user);
          setState(data);
        }}
      />
    );
  }

  // View Switcher
  const handleViewChange = (activeView: StudentData['activeView']) => {
    setState((prev) => ({ ...prev, activeView }));
  };

  // Theme Switcher
  const handleThemeChange = async (theme: ThemeKey) => {
    setState((prev) => ({ ...prev, theme }));
    try {
      await apiUpdateProfile({ ...currentUser, theme });
    } catch (e) {
      console.error('Failed to save theme preference:', e);
    }
  };

  // Logout Handler
  const handleLogout = () => {
    setSessionExpiredNotice(false);
    setCurrentUser(null);
    setState({
      courses: [],
      timeSlots: [],
      tasks: [],
      attendanceRecords: [],
      theme: 'dark-slate',
      activeView: 'dashboard',
    });
  };

  // Attendance Logger
  const handleMarkAttendance = async (courseId: string, status: AttendanceStatus) => {
    try {
      const res = await apiLogAttendance(currentUser.id, courseId, status);
      setState((prev) => ({
        ...prev,
        courses: prev.courses.map((c) => (c.id === courseId ? { ...c, totalClasses: res.updatedCourse.totalClasses, attendedClasses: res.updatedCourse.attendedClasses } : c)),
        attendanceRecords: [res.record, ...prev.attendanceRecords],
      }));
      showToast(`Logged attendance as ${status.toUpperCase()}`, 'success');
    } catch (err) {
      console.error('Error logging attendance in Postgres:', err);
      showToast('Failed to log attendance.', 'error');
    }
  };

  const handleUndoAttendance = async (courseId: string) => {
    try {
      const res = await apiUndoAttendance(currentUser.id, courseId);
      setState((prev) => ({
        ...prev,
        courses: prev.courses.map((c) => (c.id === courseId ? { ...c, totalClasses: res.updatedCourse.totalClasses, attendedClasses: res.updatedCourse.attendedClasses } : c)),
        attendanceRecords: res.deletedRecordId
          ? prev.attendanceRecords.filter((r) => r.id !== res.deletedRecordId)
          : prev.attendanceRecords,
      }));
      showToast('Undid latest attendance entry.', 'info');
    } catch (err) {
      console.error('Error undoing attendance in Postgres:', err);
      showToast('Failed to undo attendance.', 'error');
    }
  };

  // Slot Handlers
  const handleAddSlot = async (newSlot: Omit<TimeSlot, 'id' | 'userId'>) => {
    try {
      const created = await apiAddSlot({ ...newSlot, userId: currentUser.id });
      setState((prev) => ({
        ...prev,
        timeSlots: [...prev.timeSlots, created],
      }));
      showToast('Class slot added to schedule.', 'success');
    } catch (err) {
      console.error('Error adding slot in Postgres:', err);
      showToast('Failed to save slot to database.', 'error');
    }
  };

  const handleUpdateSlot = async (slot: TimeSlot) => {
    try {
      const updated = await apiUpdateSlot(slot);
      setState((prev) => ({
        ...prev,
        timeSlots: prev.timeSlots.map((s) => (s.id === slot.id ? updated : s)),
      }));
      setEditingSlot(null);
      showToast('Class slot updated successfully.', 'success');
    } catch (err) {
      console.error('Error updating slot in Postgres:', err);
      showToast('Failed to update class slot.', 'error');
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await apiDeleteSlot(slotId);
      setState((prev) => ({
        ...prev,
        timeSlots: prev.timeSlots.filter((s) => s.id !== slotId),
      }));
      showToast('Class slot deleted.', 'info');
    } catch (err) {
      console.error('Error deleting slot in Postgres:', err);
      showToast('Failed to delete class slot.', 'error');
    }
  };

  // Task Handlers
  const handleAddTask = async (newTask: Omit<Task, 'id' | 'createdAt' | 'userId'>) => {
    try {
      const created = await apiAddTask({ ...newTask, userId: currentUser.id });
      setState((prev) => ({
        ...prev,
        tasks: [created, ...prev.tasks],
      }));
    } catch (err) {
      console.error('Error creating task in Postgres:', err);
    }
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    try {
      const res = await apiUpdateTask(updatedTask);
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === res.id ? res : t)),
      }));
    } catch (err) {
      console.error('Error updating task in Postgres:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await apiDeleteTask(taskId);
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.filter((t) => t.id !== taskId),
      }));
    } catch (err) {
      console.error('Error deleting task in Postgres:', err);
    }
  };

  // Course Handlers
  const handleAddCourse = async (newCourse: Omit<Course, 'id' | 'totalClasses' | 'attendedClasses' | 'userId'>) => {
    try {
      const created = await apiAddCourse({ ...newCourse, userId: currentUser.id });
      setState((prev) => ({
        ...prev,
        courses: [...prev.courses, created],
      }));
    } catch (err) {
      console.error('Error adding course in Postgres:', err);
    }
  };

  const handleUpdateCourse = async (updatedCourse: Course) => {
    try {
      const res = await apiUpdateCourse(updatedCourse);
      setState((prev) => ({
        ...prev,
        courses: prev.courses.map((c) => (c.id === res.id ? res : c)),
      }));
    } catch (err) {
      console.error('Error updating course in Postgres:', err);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    try {
      await apiDeleteCourse(courseId);
      setState((prev) => ({
        ...prev,
        courses: prev.courses.filter((c) => c.id !== courseId),
        timeSlots: prev.timeSlots.filter((s) => s.courseId !== courseId),
        tasks: prev.tasks.map((t) => (t.courseId === courseId ? { ...t, courseId: undefined } : t)),
      }));
    } catch (err) {
      console.error('Error deleting course in Postgres:', err);
    }
  };

  // User Profile Handler
  const handleUpdateUser = async (updatedUser: UserAccount) => {
    try {
      const res = await apiUpdateProfile(updatedUser);
      setCurrentUser(res);
    } catch (err) {
      console.error('Error updating user profile in Postgres:', err);
    }
  };

  const handleUpdateGoals = async (collegeMin: number, personalGoal: number) => {
    if (currentUser) {
      const updated = {
        ...currentUser,
        collegeMinAttendance: collegeMin,
        personalGoalAttendance: personalGoal,
        targetAttendance: personalGoal,
      };
      await handleUpdateUser(updated);
    }
  };

  // Clear all data
  const handleClearAllData = async () => {
    try {
      await apiWipeData(currentUser.id);
      setState({
        courses: [],
        timeSlots: [],
        tasks: [],
        attendanceRecords: [],
        theme: state.theme,
        activeView: 'dashboard',
      });
    } catch (err) {
      console.error('Error wiping student data in Postgres:', err);
    }
  };

  // Permanently delete user account
  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    try {
      await apiDeleteAccount(currentUser.id);
      setCurrentUser(null);
      setState({
        courses: [],
        timeSlots: [],
        tasks: [],
        attendanceRecords: [],
        theme: 'dark-slate',
        activeView: 'dashboard',
      });
      localStorage.removeItem(SESSION_KEY);
      setShowSettingsModal(false);
      showToast('Your account and all associated data have been permanently deleted.', 'info');
    } catch (err) {
      console.error('Error deleting account:', err);
      showToast('Failed to delete account. Please try again.', 'error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-300">
      
      {/* Sticky Top Header */}
      <Header
        user={currentUser}
        state={state}
        onViewChange={handleViewChange}
        onThemeChange={handleThemeChange}
        onOpenAddModal={(type) => setAddModalType(type)}
        onOpenExport={() => setShowExportModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* VIEW 1: DASHBOARD */}
        {state.activeView === 'dashboard' && (
          <div>
            <LiveHero
              user={currentUser}
              state={state}
              onMarkAttendance={handleMarkAttendance}
              onViewChange={handleViewChange}
              onOpenAddModal={(type) => setAddModalType(type)}
            />

            {/* If zero courses, show empty setup state */}
            {state.courses.length === 0 ? (
              <EmptyState
                type="courses"
                themeKey={state.theme}
                studentName={currentUser.name}
                onAction={() => setAddModalType('course')}
              />
            ) : (
              <div className="mt-8 space-y-8">
                {/* Daily Schedule Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-extrabold tracking-tight" style={{ color: currentTheme.textPrimary }}>
                      Today's Lecture Schedule ({getTodayDayName()})
                    </h2>
                    <button
                      onClick={() => handleViewChange('timetable')}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                    >
                      View Weekly Matrix →
                    </button>
                  </div>
                  <TimetableGrid
                    state={state}
                    onOpenAddSlot={() => setAddModalType('slot')}
                    onOpenAddCourse={() => setAddModalType('course')}
                    onEditSlot={(slot) => setEditingSlot(slot)}
                    onDeleteSlot={handleDeleteSlot}
                    onUpdateCourse={handleUpdateCourse}
                    onDeleteCourse={handleDeleteCourse}
                    onMarkAttendance={handleMarkAttendance}
                  />
                </div>

                {/* Task Section */}
                <div className="pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-extrabold tracking-tight" style={{ color: currentTheme.textPrimary }}>
                      Assignments & Milestones
                    </h2>
                    <button
                      onClick={() => handleViewChange('tasks')}
                      className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
                    >
                      Open Kanban Board →
                    </button>
                  </div>
                  <TaskManager
                    state={state}
                    onAddTask={handleAddTask}
                    onUpdateTask={handleUpdateTask}
                    onDeleteTask={handleDeleteTask}
                    onOpenAddModal={() => setAddModalType('task')}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: FULL TIMETABLE */}
        {state.activeView === 'timetable' && (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: currentTheme.textPrimary }}>
                My Academic Timetable
              </h1>
              <p className="text-xs sm:text-sm mt-1" style={{ color: currentTheme.textSecondary }}>
                Manage your weekly lecture halls, lab sessions, and tutorial periods.
              </p>
            </div>
            <TimetableGrid
              state={state}
              onOpenAddSlot={() => setAddModalType('slot')}
              onOpenAddCourse={() => setAddModalType('course')}
              onEditSlot={(slot) => setEditingSlot(slot)}
              onDeleteSlot={handleDeleteSlot}
              onUpdateCourse={handleUpdateCourse}
              onDeleteCourse={handleDeleteCourse}
              onMarkAttendance={handleMarkAttendance}
            />
          </div>
        )}

        {/* VIEW 3: TASKS & KANBAN */}
        {state.activeView === 'tasks' && (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: currentTheme.textPrimary }}>
                Assignment & Task Kanban
              </h1>
              <p className="text-xs sm:text-sm mt-1" style={{ color: currentTheme.textSecondary }}>
                Keep track of homework deliverables, checklists, and project deadlines.
              </p>
            </div>
            <TaskManager
              state={state}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onOpenAddModal={() => setAddModalType('task')}
            />
          </div>
        )}

        {/* VIEW 4: ATTENDANCE CALCULATOR */}
        {state.activeView === 'attendance' && (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: currentTheme.textPrimary }}>
                Attendance & Safe Bunk Engine
              </h1>
              <p className="text-xs sm:text-sm mt-1" style={{ color: currentTheme.textSecondary }}>
                Real-time percentage calculations and safe bunk margin predictions per course.
              </p>
            </div>
            <AttendanceCalculator
              user={currentUser}
              state={state}
              onUpdateCourse={handleUpdateCourse}
              onDeleteCourse={handleDeleteCourse}
              onUpdateGoals={handleUpdateGoals}
              onMarkAttendance={handleMarkAttendance}
              onUndoAttendance={handleUndoAttendance}
              onOpenAddCourse={() => setAddModalType('course')}
            />
          </div>
        )}

        {/* VIEW 5: EXAM COUNTDOWN HUB */}
        {state.activeView === 'exams' && (
          <div>
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: currentTheme.textPrimary }}>
                Exam & Viva Countdown Hub
              </h1>
              <p className="text-xs sm:text-sm mt-1" style={{ color: currentTheme.textSecondary }}>
                Live countdown timers and syllabus topic checklists for upcoming college examinations.
              </p>
            </div>
            <ExamCountdownHub
              state={state}
              onOpenAddModal={() => setAddModalType('task')}
              onUpdateTask={handleUpdateTask}
            />
          </div>
        )}

      </main>

      {/* MODALS */}
      {(addModalType || editingSlot) && (
        <AddModal
          type={addModalType || 'slot'}
          initialSlot={editingSlot}
          state={state}
          defaultTargetAttendance={currentUser.personalGoalAttendance || currentUser.collegeMinAttendance || 75}
          onClose={() => {
            setAddModalType(null);
            setEditingSlot(null);
          }}
          onAddSlot={handleAddSlot}
          onUpdateSlot={handleUpdateSlot}
          onAddTask={handleAddTask}
          onAddCourse={handleAddCourse}
        />
      )}

      {showExportModal && (
        <ExportModal
          user={currentUser}
          state={state}
          onClose={() => setShowExportModal(false)}
          onRestoreState={(restored) => setState(restored)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          user={currentUser}
          state={state}
          onClose={() => setShowSettingsModal(false)}
          onUpdateUser={handleUpdateUser}
          onUpdateCourse={handleUpdateCourse}
          onDeleteCourse={handleDeleteCourse}
          onClearAllData={handleClearAllData}
          onDeleteAccount={handleDeleteAccount}
        />
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2 transition-all ${
          toastMessage.type === 'success'
            ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40 shadow-emerald-900/30'
            : toastMessage.type === 'error'
            ? 'bg-rose-950/90 text-rose-300 border-rose-500/40 shadow-rose-900/30'
            : 'bg-slate-900/90 text-white border-white/20'
        }`}>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto py-6 border-t text-center text-xs"
        style={{ borderColor: currentTheme.cardBorder, color: currentTheme.textSecondary }}
      >
        <p className="font-medium">
          AcademiaSync • Connected to Local PostgreSQL • Student: {currentUser.name} ({currentUser.collegeName})
        </p>
      </footer>

    </div>
  );
}

export default App;
