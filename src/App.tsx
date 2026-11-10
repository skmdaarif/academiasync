import { useState, useEffect } from 'react';
import { 
  StudentData, 
  Course, 
  TimeSlot, 
  Task, 
  UserAccount, 
  ThemeKey, 
  AttendanceStatus,
  Exam
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
  apiAddExam,
  apiUpdateExam,
  apiDeleteExam,
  apiLogAttendance, 
  apiUndoAttendance,
  apiDeleteAttendanceRecord,
  apiUpdateProfile, 
  apiWipeData,
  apiDeleteAccount,
  apiRestoreStudentData,
  apiBackfillSemesters,
  apiPromoteSemester
} from './services/api';
import { THEMES } from './styles/themes';
import { AuthScreen } from './components/AuthScreen';
import { Header } from './components/Header';
import { LiveHero } from './components/LiveHero';
import { TimetableGrid } from './components/TimetableGrid';
import { TaskManager } from './components/TaskManager';
import { AttendanceCalculator } from './components/AttendanceCalculator';
import { AttendanceHistoryModal } from './components/AttendanceHistoryModal';
import { ExamCountdownHub } from './components/ExamCountdownHub';
import { AddModal } from './components/AddModal';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { PdfImportModal } from './components/PdfImportModal';
import { PromoteSemesterModal } from './components/PromoteSemesterModal';
import { AcademicVaultModal } from './components/AcademicVaultModal';
import { EmptyState } from './components/EmptyState';
import { getTodayDayName } from './utils/timeUtils';
import { AcademicSemester } from './types';
import { History, ArrowLeft, Award, Sparkles, TrendingUp } from 'lucide-react';

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
  const [showAttendanceHistory, setShowAttendanceHistory] = useState(false);
  const [showPdfImportModal, setShowPdfImportModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [selectedSemesterNumber, setSelectedSemesterNumber] = useState<number | null>(null);
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
  const handleMarkAttendance = async (
    courseId: string, 
    status: AttendanceStatus, 
    date?: string, 
    note?: string
  ) => {
    try {
      const activeSem = currentUser.activeSemesterNumber || parseInt(String(currentUser.semester).replace(/\D/g, ''), 10) || 1;
      const res = await apiLogAttendance(currentUser.id, courseId, status, date, note, activeSem);
      setState((prev) => ({
        ...prev,
        courses: prev.courses.map((c) => (c.id === courseId ? { ...c, totalClasses: res.updatedCourse.totalClasses, attendedClasses: res.updatedCourse.attendedClasses } : c)),
        attendanceRecords: [res.record, ...prev.attendanceRecords],
      }));
      showToast(`Logged attendance as ${status.toUpperCase()}`, 'success');
    } catch (err) {
      console.error('Error logging attendance in database:', err);
      showToast('Failed to log attendance.', 'error');
    }
  };

  const handleDeleteAttendanceRecord = async (recordId: string) => {
    try {
      const res = await apiDeleteAttendanceRecord(currentUser.id, recordId);
      setState((prev) => ({
        ...prev,
        courses: res.updatedCourse
          ? prev.courses.map((c) => (c.id === res.updatedCourse!.id ? { ...c, totalClasses: res.updatedCourse!.totalClasses, attendedClasses: res.updatedCourse!.attendedClasses } : c))
          : prev.courses,
        attendanceRecords: prev.attendanceRecords.filter((r) => r.id !== recordId),
      }));
      showToast('Attendance record removed.', 'info');
    } catch (err) {
      console.error('Error deleting attendance record:', err);
      showToast('Failed to delete attendance record.', 'error');
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
      console.error('Error undoing attendance in database:', err);
      showToast('Failed to undo attendance.', 'error');
    }
  };

  // Slot Handlers
  const handleAddSlot = async (newSlot: Omit<TimeSlot, 'id' | 'userId'>) => {
    try {
      const activeSem = currentUser.activeSemesterNumber || parseInt(String(currentUser.semester).replace(/\D/g, ''), 10) || 1;
      const created = await apiAddSlot({ ...newSlot, userId: currentUser.id, semesterNumber: activeSem });
      setState((prev) => ({
        ...prev,
        timeSlots: [...prev.timeSlots, created],
      }));
      showToast('Class slot added to schedule.', 'success');
    } catch (err) {
      console.error('Error adding slot in database:', err);
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
      console.error('Error updating slot in database:', err);
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
      console.error('Error deleting slot in database:', err);
      showToast('Failed to delete class slot.', 'error');
    }
  };

  // Task Handlers
  const handleAddTask = async (newTask: Omit<Task, 'id' | 'createdAt' | 'userId'>) => {
    try {
      const activeSem = currentUser.activeSemesterNumber || parseInt(String(currentUser.semester).replace(/\D/g, ''), 10) || 1;
      const created = await apiAddTask({ ...newTask, userId: currentUser.id, semesterNumber: activeSem });
      setState((prev) => ({
        ...prev,
        tasks: [created, ...prev.tasks],
      }));
    } catch (err) {
      console.error('Error creating task in database:', err);
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
      console.error('Error updating task in database:', err);
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
      console.error('Error deleting task in database:', err);
    }
  };

  // Exam Handlers
  const handleAddExam = async (newExam: Omit<Exam, 'id' | 'createdAt'>) => {
    if (!currentUser) return;
    try {
      const activeSem = currentUser.activeSemesterNumber || parseInt(String(currentUser.semester).replace(/\D/g, ''), 10) || 1;
      const created = await apiAddExam({ ...newExam, userId: currentUser.id, semesterNumber: activeSem });
      setState((prev) => ({
        ...prev,
        exams: [...(prev.exams || []), created],
      }));
      showToast('Assessment scheduled successfully!', 'success');
    } catch (err: any) {
      console.error('Error adding exam:', err);
      showToast('Failed to schedule exam', 'error');
    }
  };

  const handleUpdateExam = async (exam: Exam) => {
    if (!currentUser) return;
    try {
      const updated = await apiUpdateExam(exam);
      setState((prev) => ({
        ...prev,
        exams: (prev.exams || []).map((e) => (e.id === updated.id ? updated : e)),
      }));
      showToast('Exam updated!', 'info');
    } catch (err: any) {
      console.error('Error updating exam:', err);
      showToast('Failed to update exam', 'error');
    }
  };

  const handleDeleteExam = async (examId: string) => {
    if (!currentUser) return;
    try {
      await apiDeleteExam(examId, currentUser.id);
      setState((prev) => ({
        ...prev,
        exams: (prev.exams || []).filter((e) => e.id !== examId),
      }));
      showToast('Exam removed', 'info');
    } catch (err: any) {
      console.error('Error deleting exam:', err);
      showToast('Failed to delete exam', 'error');
    }
  };

  // Course Handlers
  const handleAddCourse = async (newCourse: Omit<Course, 'id' | 'totalClasses' | 'attendedClasses' | 'userId'>) => {
    try {
      const activeSem = currentUser.activeSemesterNumber || parseInt(String(currentUser.semester).replace(/\D/g, ''), 10) || 1;
      const created = await apiAddCourse({ ...newCourse, userId: currentUser.id, semesterNumber: activeSem });
      setState((prev) => ({
        ...prev,
        courses: [...prev.courses, created],
      }));
    } catch (err) {
      console.error('Error adding course in database:', err);
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
      console.error('Error updating course in database:', err);
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
      console.error('Error deleting course in database:', err);
    }
  };

  // User Profile Handler
  const handleUpdateUser = async (updatedUser: UserAccount) => {
    try {
      const res = await apiUpdateProfile(updatedUser);
      setCurrentUser(res);
    } catch (err) {
      console.error('Error updating user profile in database:', err);
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

  // Multi-Semester Advancement & Performance Vault Handlers
  const handlePromoteSemester = async (
    nextSemesterNumber: number,
    summary: { finalAttendancePct?: number; creditsEarned: number; sgpa?: number; notes?: string }
  ) => {
    if (!currentUser) return;
    try {
      const res = await apiPromoteSemester(currentUser.id, nextSemesterNumber, summary);
      if (res.success && res.user && res.data) {
        setCurrentUser(res.user);
        setState(res.data);
        setSelectedSemesterNumber(null);
        localStorage.setItem(SESSION_KEY, JSON.stringify(res.user));
        showToast(`🎉 Promoted to Semester ${nextSemesterNumber}! Welcome to your new semester.`, 'success');
      }
    } catch (err: any) {
      console.error('Promotion error:', err);
      showToast(err.message || 'Failed to promote semester.', 'error');
    }
  };

  const handleUpdateSemesters = async (semesters: AcademicSemester[]) => {
    if (!currentUser) return;
    try {
      const res = await apiBackfillSemesters(currentUser.id, semesters);
      if (res.success) {
        setState((prev) => ({
          ...prev,
          semesters: res.semesters,
        }));
        showToast('Semester performance records updated in Vault.', 'success');
      }
    } catch (err: any) {
      console.error('Update semesters error:', err);
      showToast(err.message || 'Failed to update semester records.', 'error');
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

  // 1-Click Sync Local Data to SQLite Database
  const handleSyncToSQLite = async () => {
    if (!currentUser) return;
    try {
      const res = await apiRestoreStudentData(currentUser.id, state);
      if (res.success) {
        const updatedUser: UserAccount = { ...currentUser, storageMode: 'sqlite' };
        setCurrentUser(updatedUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
        showToast('All timetable data & attendance records synchronized to SQLite database!', 'success');
      }
    } catch (err) {
      console.error('Error synchronizing to SQLite:', err);
      showToast('Failed to sync to SQLite database.', 'error');
    }
  };

  // Auto-Scan Timetable PDF Importer Handler
  const handleApplyPdfImport = async (
    newCourses: Course[],
    newSlots: TimeSlot[],
    updatedProfile?: Partial<UserAccount>
  ) => {
    if (!currentUser) return;

    const activeSem = currentUser.activeSemesterNumber || parseInt(String(currentUser.semester).replace(/\D/g, ''), 10) || 1;
    const otherCourses = state.courses.filter((c) => (c.semesterNumber || 1) !== activeSem);
    const otherSlots = state.timeSlots.filter((s) => (s.semesterNumber || 1) !== activeSem);

    // Code-based matching to prevent regenerating new IDs & preserving existing attendance records & baselines
    const existingActiveCourses = state.courses.filter((c) => (c.semesterNumber || 1) === activeSem);
    const existingCourseByCode = new Map(existingActiveCourses.map((c) => [c.code.trim().toUpperCase(), c]));
    const idRemap = new Map<string, string>();

    const finalizedCourses: Course[] = [];

    for (const nc of newCourses) {
      const codeKey = nc.code.trim().toUpperCase();
      const existing = existingCourseByCode.get(codeKey);
      if (existing) {
        idRemap.set(nc.id, existing.id);
        finalizedCourses.push({
          ...existing,
          name: nc.name || existing.name,
          professor: nc.professor || existing.professor,
          defaultRoom: nc.defaultRoom || existing.defaultRoom,
          color: existing.color || nc.color,
          credits: nc.credits || existing.credits,
          semesterNumber: activeSem,
        });
      } else {
        finalizedCourses.push({
          ...nc,
          semesterNumber: activeSem,
        });
      }
    }

    const finalizedSlots: TimeSlot[] = newSlots.map((s) => ({
      ...s,
      courseId: idRemap.get(s.courseId) || s.courseId,
      semesterNumber: activeSem,
    }));

    const mergedState: StudentData = {
      ...state,
      courses: [...otherCourses, ...finalizedCourses],
      timeSlots: [...otherSlots, ...finalizedSlots],
    };

    setState(mergedState);

    try {
      await apiRestoreStudentData(currentUser.id, mergedState);
    } catch (err) {
      console.error('Failed to sync imported PDF timetable to database:', err);
    }

    if (updatedProfile && Object.keys(updatedProfile).length > 0) {
      const updatedUser: UserAccount = { ...currentUser, ...updatedProfile };
      setCurrentUser(updatedUser);
      localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
      try {
        await apiUpdateProfile(updatedUser);
      } catch (err) {
        console.error('Failed to update student profile from PDF metadata:', err);
      }
    }

    showToast(`Successfully imported ${newCourses.length} courses & ${newSlots.length} timetable slots for Semester ${activeSem}!`, 'success');
  };

  const activeSemesterNumber = currentUser?.activeSemesterNumber || parseInt(String(currentUser?.semester).replace(/\D/g, ''), 10) || 1;
  const currentViewSemesterNumber = selectedSemesterNumber ?? activeSemesterNumber;
  const isViewingHistorical = currentViewSemesterNumber !== activeSemesterNumber;

  const viewCourses = state.courses.filter((c) => (c.semesterNumber || 1) === currentViewSemesterNumber);
  const viewSlots = state.timeSlots.filter((s) => (s.semesterNumber || 1) === currentViewSemesterNumber);
  const viewTasks = state.tasks.filter((t) => (t.semesterNumber || 1) === currentViewSemesterNumber);
  const viewAttendance = state.attendanceRecords.filter((a) => (a.semesterNumber || 1) === currentViewSemesterNumber);
  const viewExams = (state.exams || []).filter((e) => (e.semesterNumber || 1) === currentViewSemesterNumber);

  const viewState: StudentData = {
    ...state,
    courses: viewCourses,
    timeSlots: viewSlots,
    tasks: viewTasks,
    attendanceRecords: viewAttendance,
    exams: viewExams,
  };

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors duration-300">
      
      {/* Sticky Top Header */}
      <Header
        user={currentUser}
        state={state}
        selectedSemesterNumber={currentViewSemesterNumber}
        onSelectSemester={(semNum) => setSelectedSemesterNumber(semNum === activeSemesterNumber ? null : semNum)}
        onOpenVault={() => setShowVaultModal(true)}
        onOpenPromoteModal={() => setShowPromoteModal(true)}
        onViewChange={handleViewChange}
        onThemeChange={handleThemeChange}
        onOpenAddModal={(type) => setAddModalType(type)}
        onOpenExport={() => setShowExportModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        {/* Historical Archive Banner */}
        {isViewingHistorical && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 font-bold">
                🏛️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    Historical Archive View
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                    Semester {currentViewSemesterNumber} (Read-Only)
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  You are viewing preserved timetable matrices, courses, and attendance logs from Semester {currentViewSemesterNumber}.
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedSemesterNumber(null)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 shadow-md transition-all shrink-0 flex items-center gap-1.5"
            >
              <span>← Return to Active Semester ({activeSemesterNumber})</span>
            </button>
          </div>
        )}

        {/* Backfilled Semester Performance Notice (if no weekly timetable logged) */}
        {(() => {
          const currentSemRecord = state.semesters?.find((s) => s.semesterNumber === currentViewSemesterNumber);
          if (currentSemRecord && currentSemRecord.status === 'backfilled' && viewCourses.length === 0) {
            return (
              <div className="mb-6 p-5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-400" />
                    <span>Semester {currentViewSemesterNumber} Performance Snapshot (Backfilled Record)</span>
                  </h3>
                  <button
                    onClick={() => setShowVaultModal(true)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    Edit in Vault →
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  This semester was logged during smart onboarding as a prior completed semester.
                </p>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-400">Attendance</span>
                    <div className="text-base font-bold text-white">
                      {currentSemRecord.finalAttendancePct !== undefined && currentSemRecord.finalAttendancePct !== null
                        ? `${currentSemRecord.finalAttendancePct.toFixed(1)}%`
                        : 'N/A'}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-400">Credits Earned</span>
                    <div className="text-base font-bold text-white">{currentSemRecord.creditsEarned} Cr</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-400">SGPA</span>
                    <div className="text-base font-bold text-white">{currentSemRecord.sgpa ? currentSemRecord.sgpa.toFixed(2) : '—'}</div>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}
        
        {/* VIEW 1: DASHBOARD */}
        {state.activeView === 'dashboard' && (
          <div>
            <LiveHero
              user={currentUser}
              state={viewState}
              onMarkAttendance={handleMarkAttendance}
              onViewChange={handleViewChange}
              onOpenAddModal={(type) => setAddModalType(type)}
            />

            {/* If zero courses, show empty setup state */}
            {viewState.courses.length === 0 ? (
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
                    state={viewState}
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
                    state={viewState}
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
            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: currentTheme.textPrimary }}>
                  {isViewingHistorical ? `Semester ${currentViewSemesterNumber} Timetable Archive` : 'My Academic Timetable'}
                </h1>
                <p className="text-xs sm:text-sm mt-1" style={{ color: currentTheme.textSecondary }}>
                  {isViewingHistorical
                    ? `Viewing saved schedule slots and labs from Semester ${currentViewSemesterNumber}.`
                    : 'Manage your weekly lecture halls, lab sessions, and tutorial periods.'}
                </p>
              </div>

              {!isViewingHistorical && (
                <button
                  onClick={() => setShowPromoteModal(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition-all flex items-center gap-1.5"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Advance Semester</span>
                </button>
              )}
            </div>
            <TimetableGrid
              state={viewState}
              onOpenAddSlot={() => setAddModalType('slot')}
              onOpenAddCourse={() => setAddModalType('course')}
              onOpenPdfImport={() => setShowPdfImportModal(true)}
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
                Keep track of homework deliverables, checklists, and project deadlines for Semester {currentViewSemesterNumber}.
              </p>
            </div>
            <TaskManager
              state={viewState}
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
                Real-time percentage calculations and safe bunk margin predictions for Semester {currentViewSemesterNumber}.
              </p>
            </div>
            <AttendanceCalculator
              user={currentUser}
              state={viewState}
              onUpdateCourse={handleUpdateCourse}
              onDeleteCourse={handleDeleteCourse}
              onUpdateGoals={handleUpdateGoals}
              onMarkAttendance={handleMarkAttendance}
              onUndoAttendance={handleUndoAttendance}
              onOpenAddCourse={() => setAddModalType('course')}
              onOpenHistory={() => setShowAttendanceHistory(true)}
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
              state={viewState}
              onOpenAddModal={() => setAddModalType('task')}
              onUpdateTask={handleUpdateTask}
              onAddExam={handleAddExam}
              onUpdateExam={handleUpdateExam}
              onDeleteExam={handleDeleteExam}
            />
          </div>
        )}

      </main>

      {/* MODALS */}
      {(addModalType || editingSlot) && (
        <AddModal
          type={addModalType || 'slot'}
          initialSlot={editingSlot}
          state={viewState}
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
          onOpenPdfImport={() => setShowPdfImportModal(true)}
        />
      )}

      {showPdfImportModal && (
        <PdfImportModal
          user={currentUser}
          state={state}
          onClose={() => setShowPdfImportModal(false)}
          onApplyImport={handleApplyPdfImport}
        />
      )}

      {showPromoteModal && (
        <PromoteSemesterModal
          user={currentUser}
          state={state}
          onClose={() => setShowPromoteModal(false)}
          onPromote={handlePromoteSemester}
          onOpenPdfScanner={() => setShowPdfImportModal(true)}
        />
      )}

      {showVaultModal && (
        <AcademicVaultModal
          user={currentUser}
          state={state}
          onClose={() => setShowVaultModal(false)}
          onSelectSemesterForViewing={(semNum) => setSelectedSemesterNumber(semNum === activeSemesterNumber ? null : semNum)}
          onUpdateSemesters={handleUpdateSemesters}
          onOpenPromoteModal={() => setShowPromoteModal(true)}
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
          onSyncToSQLite={handleSyncToSQLite}
          onOpenVault={() => setShowVaultModal(true)}
        />
      )}

      {showAttendanceHistory && (
        <AttendanceHistoryModal
          state={viewState}
          onClose={() => setShowAttendanceHistory(false)}
          onLogAttendance={handleMarkAttendance}
          onDeleteRecord={handleDeleteAttendanceRecord}
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
          AcademiaSync • Connected to Local SQLite Database • Student: {currentUser.name} ({currentUser.collegeName})
        </p>
      </footer>

    </div>
  );
}

export default App;
