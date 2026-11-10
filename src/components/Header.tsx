import { useState, useEffect } from 'react';
import { 
  Calendar, 
  CheckSquare, 
  PieChart, 
  Clock, 
  Flame, 
  Download, 
  Plus, 
  Palette, 
  Settings as SettingsIcon,
  BookOpen,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Award,
  TrendingUp,
  History
} from 'lucide-react';
import { StudentData, ThemeKey, UserAccount } from '../types';
import { THEMES } from '../styles/themes';

interface HeaderProps {
  user: UserAccount;
  state: StudentData;
  selectedSemesterNumber?: number;
  onSelectSemester?: (semNumber: number) => void;
  onOpenVault?: () => void;
  onOpenPromoteModal?: () => void;
  onViewChange: (view: StudentData['activeView']) => void;
  onThemeChange: (theme: ThemeKey) => void;
  onOpenAddModal: (type: 'slot' | 'task' | 'course') => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export function Header({
  user,
  state,
  selectedSemesterNumber,
  onSelectSemester,
  onOpenVault,
  onOpenPromoteModal,
  onViewChange,
  onThemeChange,
  onOpenAddModal,
  onOpenExport,
  onOpenSettings,
  onLogout,
}: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSemesterMenu, setShowSemesterMenu] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formattedDate = time.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const currentTheme = THEMES[state.theme] || THEMES['dark-slate'];
  const pendingTasksCount = state.tasks.filter((t) => t.status !== 'completed').length;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl border-b transition-colors duration-300"
      style={{
        backgroundColor: currentTheme.headerBg,
        borderColor: currentTheme.cardBorder,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Student Info */}
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-lg cursor-pointer transition-transform hover:scale-105"
              style={{
                backgroundColor: currentTheme.accent,
                boxShadow: `0 0 15px ${currentTheme.accentGlow}`,
              }}
              onClick={() => onViewChange('dashboard')}
            >
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight" style={{ color: currentTheme.textPrimary }}>
                  Academia<span style={{ color: currentTheme.accent }}>Sync</span>
                </span>

                {/* Interactive Multi-Semester Badge & Switcher */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSemesterMenu(!showSemesterMenu)}
                    className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all hover:scale-105"
                    style={{
                      backgroundColor: selectedSemesterNumber && selectedSemesterNumber !== (user.activeSemesterNumber || 1)
                        ? 'rgba(245, 158, 11, 0.15)'
                        : currentTheme.badgeBg,
                      borderColor: selectedSemesterNumber && selectedSemesterNumber !== (user.activeSemesterNumber || 1)
                        ? 'rgba(245, 158, 11, 0.4)'
                        : currentTheme.cardBorder,
                      color: selectedSemesterNumber && selectedSemesterNumber !== (user.activeSemesterNumber || 1)
                        ? '#fbbf24'
                        : currentTheme.accent,
                    }}
                    title="Switch Semester or View Academic Vault"
                  >
                    <span>
                      {selectedSemesterNumber && selectedSemesterNumber !== (user.activeSemesterNumber || 1)
                        ? `Viewing Sem ${selectedSemesterNumber} (Archive)`
                        : user.semester || `Semester ${user.activeSemesterNumber || 1}`}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-70" />
                  </button>

                  {/* Semester Dropdown Menu */}
                  {showSemesterMenu && (
                    <div 
                      className="absolute left-0 mt-2 w-64 rounded-2xl p-2 border shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-2xl"
                      style={{
                        backgroundColor: currentTheme.headerBg,
                        borderColor: currentTheme.cardBorder,
                      }}
                    >
                      <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Academic Semesters</span>
                        <span className="text-indigo-400 font-semibold cursor-pointer hover:underline" onClick={() => {
                          setShowSemesterMenu(false);
                          if (onOpenVault) onOpenVault();
                        }}>
                          Vault
                        </span>
                      </div>

                      {/* Semester items */}
                      <div className="space-y-1 my-1 max-h-48 overflow-y-auto pr-0.5">
                        {state.semesters && state.semesters.length > 0 ? (
                          [...state.semesters]
                            .sort((a, b) => b.semesterNumber - a.semesterNumber)
                            .map((sem) => {
                              const isActive = sem.semesterNumber === (user.activeSemesterNumber || 1);
                              const isSelected = (selectedSemesterNumber || user.activeSemesterNumber || 1) === sem.semesterNumber;

                              return (
                                <button
                                  key={sem.semesterNumber}
                                  type="button"
                                  onClick={() => {
                                    if (onSelectSemester) onSelectSemester(sem.semesterNumber);
                                    setShowSemesterMenu(false);
                                  }}
                                  className={`w-full px-2.5 py-2 rounded-xl text-left text-xs transition-all flex items-center justify-between ${
                                    isSelected
                                      ? 'bg-indigo-600/25 border border-indigo-500/40 text-white font-bold'
                                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span>{sem.title}</span>
                                      {isActive && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 block font-normal">
                                      {sem.creditsEarned} Cr{sem.finalAttendancePct ? ` • ${sem.finalAttendancePct.toFixed(0)}%` : ''}
                                    </span>
                                  </div>

                                  <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider ${
                                    isActive
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-white/10 text-slate-400'
                                  }`}>
                                    {isActive ? 'Active' : sem.status}
                                  </span>
                                </button>
                              );
                            })
                        ) : (
                          <div className="px-2.5 py-2 text-xs text-slate-400">
                            Current: {user.semester} (Active)
                          </div>
                        )}
                      </div>

                      <div className="pt-1.5 mt-1 border-t border-white/10 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setShowSemesterMenu(false);
                            if (onOpenPromoteModal) onOpenPromoteModal();
                          }}
                          className="w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-2"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Promote to Next Semester...</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowSemesterMenu(false);
                            if (onOpenVault) onOpenVault();
                          }}
                          className="w-full px-2.5 py-1.5 rounded-xl text-left text-xs font-medium text-indigo-300 hover:bg-indigo-500/10 transition-colors flex items-center gap-2"
                        >
                          <Award className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Open Academic Vault</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <span 
                  className="hidden md:inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-white/5 border-white/10 text-slate-300"
                  title={user.storageMode !== 'local' ? 'Data stored in local SQLite database (data/academiasync.db)' : 'Data stored safely in browser Local Storage'}
                >
                  {user.storageMode !== 'local' ? '🗄️ SQLite DB' : '🟢 Local Storage'}
                </span>
                <span 
                  className="hidden lg:inline-flex text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                  title="AcademiaSync Universal App v2.1.0"
                >
                  v2.1
                </span>
              </div>
              <p className="text-xs truncate max-w-[160px] sm:max-w-xs font-medium" style={{ color: currentTheme.textSecondary }}>
                {user.collegeName} • {user.branch}
              </p>
            </div>
          </div>

          {/* Navigation Pills */}
          <nav className="hidden md:flex items-center gap-1.5 p-1 rounded-2xl border"
            style={{
              backgroundColor: currentTheme.cardBg,
              borderColor: currentTheme.cardBorder,
            }}
          >
            <button
              onClick={() => onViewChange('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                state.activeView === 'dashboard'
                  ? 'text-white shadow-sm'
                  : 'hover:text-white'
              }`}
              style={{
                backgroundColor: state.activeView === 'dashboard' ? currentTheme.accent : 'transparent',
                color: state.activeView === 'dashboard' ? '#ffffff' : currentTheme.textSecondary,
              }}
            >
              <Clock className="w-4 h-4" />
              Dashboard
            </button>

            <button
              onClick={() => onViewChange('timetable')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                state.activeView === 'timetable'
                  ? 'text-white shadow-sm'
                  : 'hover:text-white'
              }`}
              style={{
                backgroundColor: state.activeView === 'timetable' ? currentTheme.accent : 'transparent',
                color: state.activeView === 'timetable' ? '#ffffff' : currentTheme.textSecondary,
              }}
            >
              <Calendar className="w-4 h-4" />
              Timetable
            </button>

            <button
              onClick={() => onViewChange('tasks')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all relative ${
                state.activeView === 'tasks'
                  ? 'text-white shadow-sm'
                  : 'hover:text-white'
              }`}
              style={{
                backgroundColor: state.activeView === 'tasks' ? currentTheme.accent : 'transparent',
                color: state.activeView === 'tasks' ? '#ffffff' : currentTheme.textSecondary,
              }}
            >
              <CheckSquare className="w-4 h-4" />
              Tasks
              {pendingTasksCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                  {pendingTasksCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onViewChange('attendance')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                state.activeView === 'attendance'
                  ? 'text-white shadow-sm'
                  : 'hover:text-white'
              }`}
              style={{
                backgroundColor: state.activeView === 'attendance' ? currentTheme.accent : 'transparent',
                color: state.activeView === 'attendance' ? '#ffffff' : currentTheme.textSecondary,
              }}
            >
              <PieChart className="w-4 h-4" />
              Attendance
            </button>

            <button
              onClick={() => onViewChange('exams')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all ${
                state.activeView === 'exams'
                  ? 'text-white shadow-sm'
                  : 'hover:text-white'
              }`}
              style={{
                backgroundColor: state.activeView === 'exams' ? currentTheme.accent : 'transparent',
                color: state.activeView === 'exams' ? '#ffffff' : currentTheme.textSecondary,
              }}
            >
              <Flame className="w-4 h-4" />
              Exams
            </button>
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Live Clock Badge */}
            <div 
              className="hidden xl:flex flex-col items-end px-3 py-1 rounded-xl border text-right"
              style={{
                backgroundColor: currentTheme.cardBg,
                borderColor: currentTheme.cardBorder,
              }}
            >
              <span className="font-mono text-xs font-semibold tracking-wider" style={{ color: currentTheme.textPrimary }}>
                {formattedTime}
              </span>
              <span className="text-[10px] uppercase font-medium" style={{ color: currentTheme.textSecondary }}>
                {formattedDate}
              </span>
            </div>

            {/* Quick Add Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-md transition-transform hover:scale-105"
                style={{
                  backgroundColor: currentTheme.accent,
                  boxShadow: `0 0 12px ${currentTheme.accentGlow}`,
                }}
              >
                <Plus className="w-4 h-4" />
                <span>Add</span>
              </button>

              {showAddMenu && (
                <div 
                  className="absolute right-0 mt-2 w-48 rounded-2xl p-2 border shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
                  style={{
                    backgroundColor: currentTheme.headerBg,
                    borderColor: currentTheme.cardBorder,
                  }}
                  onMouseLeave={() => setShowAddMenu(false)}
                >
                  <button
                    onClick={() => {
                      onOpenAddModal('course');
                      setShowAddMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-white/10 text-left"
                    style={{ color: currentTheme.textPrimary }}
                  >
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    Add Course
                  </button>
                  <button
                    onClick={() => {
                      onOpenAddModal('slot');
                      setShowAddMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-white/10 text-left"
                    style={{ color: currentTheme.textPrimary }}
                  >
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    Add Class Slot
                  </button>
                  <button
                    onClick={() => {
                      onOpenAddModal('task');
                      setShowAddMenu(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors hover:bg-white/10 text-left"
                    style={{ color: currentTheme.textPrimary }}
                  >
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                    Add Task / Exam
                  </button>
                </div>
              )}
            </div>

            {/* Theme Picker Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowThemePicker(!showThemePicker)}
                className="p-2 rounded-xl border transition-colors hover:bg-white/10"
                style={{
                  backgroundColor: currentTheme.cardBg,
                  borderColor: currentTheme.cardBorder,
                  color: currentTheme.textPrimary,
                }}
                title="Change Theme"
              >
                <Palette className="w-4 h-4" />
              </button>

              {showThemePicker && (
                <div 
                  className="absolute right-0 mt-2 w-56 rounded-2xl p-2.5 border shadow-2xl z-50"
                  style={{
                    backgroundColor: currentTheme.headerBg,
                    borderColor: currentTheme.cardBorder,
                  }}
                  onMouseLeave={() => setShowThemePicker(false)}
                >
                  <p className="text-xs font-semibold px-2 py-1 mb-1" style={{ color: currentTheme.textSecondary }}>
                    Aesthetic Themes
                  </p>
                  {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
                    const t = THEMES[key];
                    const isSelected = state.theme === key;
                    return (
                      <button
                        key={key}
                        onClick={() => {
                          onThemeChange(key);
                          setShowThemePicker(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                          isSelected ? 'bg-white/15' : 'hover:bg-white/10'
                        }`}
                        style={{ color: t.textPrimary }}
                      >
                        <span className="flex items-center gap-2">
                          <span>{t.icon}</span>
                          <span>{t.name}</span>
                        </span>
                        <span 
                          className="w-3.5 h-3.5 rounded-full border border-white/20"
                          style={{ backgroundColor: t.accent }}
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Export & Sync */}
            <button
              onClick={onOpenExport}
              className="p-2 rounded-xl border transition-colors hover:bg-white/10"
              style={{
                backgroundColor: currentTheme.cardBg,
                borderColor: currentTheme.cardBorder,
                color: currentTheme.textPrimary,
              }}
              title="Export Calendar / Backup"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Student User Profile Avatar & Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white border shadow-md transition-transform hover:scale-105"
                style={{
                  backgroundColor: currentTheme.accent,
                  borderColor: currentTheme.cardBorder,
                }}
                title={user.name}
              >
                {user.name.charAt(0).toUpperCase()}
              </button>

              {showUserMenu && (
                <div 
                  className="absolute right-0 mt-2 w-56 rounded-2xl p-2.5 border shadow-2xl z-50 text-left"
                  style={{
                    backgroundColor: currentTheme.headerBg,
                    borderColor: currentTheme.cardBorder,
                  }}
                  onMouseLeave={() => setShowUserMenu(false)}
                >
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <p className="text-xs font-bold truncate" style={{ color: currentTheme.textPrimary }}>
                      {user.name}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {user.email}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      onOpenSettings();
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                  >
                    <SettingsIcon className="w-3.5 h-3.5" />
                    Edit Profile & Goals
                  </button>

                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-950/30 transition-colors mt-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Mobile Nav Row */}
        <div className="flex md:hidden items-center justify-around py-2 border-t"
          style={{ borderColor: currentTheme.cardBorder }}
        >
          <button
            onClick={() => onViewChange('dashboard')}
            className={`p-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 ${
              state.activeView === 'dashboard' ? 'text-indigo-400' : 'text-slate-400'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Home</span>
          </button>
          <button
            onClick={() => onViewChange('timetable')}
            className={`p-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 ${
              state.activeView === 'timetable' ? 'text-indigo-400' : 'text-slate-400'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Schedule</span>
          </button>
          <button
            onClick={() => onViewChange('tasks')}
            className={`p-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 relative ${
              state.activeView === 'tasks' ? 'text-indigo-400' : 'text-slate-400'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Tasks</span>
            {pendingTasksCount > 0 && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>
          <button
            onClick={() => onViewChange('attendance')}
            className={`p-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 ${
              state.activeView === 'attendance' ? 'text-indigo-400' : 'text-slate-400'
            }`}
          >
            <PieChart className="w-4 h-4" />
            <span>Attendance</span>
          </button>
          <button
            onClick={() => onViewChange('exams')}
            className={`p-2 rounded-lg text-xs font-medium flex flex-col items-center gap-1 ${
              state.activeView === 'exams' ? 'text-indigo-400' : 'text-slate-400'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>Exams</span>
          </button>
        </div>

      </div>
    </header>
  );
}
