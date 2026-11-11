import { useState, useEffect } from 'react';
import { 
  Sparkles, 
  MapPin, 
  User as UserIcon, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Coffee,
  CalendarCheck,
  Plus,
  BookOpen,
  Bell,
  Volume2,
  VolumeX,
  Palmtree
} from 'lucide-react';
import { StudentData, AttendanceStatus, UserAccount } from '../types';
import { THEMES } from '../styles/themes';
import { getCurrentAndNextClass, formatTime12h, calculateAttendance, playCampusBellChime, getSlotDurationMultiplier } from '../utils/timeUtils';
import { sendAppNotification, requestNotificationPermission } from '../services/platform';
import confetti from 'canvas-confetti';

interface LiveHeroProps {
  user: UserAccount;
  state: StudentData;
  onMarkAttendance: (courseId: string, status: AttendanceStatus, date?: string, note?: string, documentRef?: string, durationMultiplier?: number) => void;
  onViewChange: (view: StudentData['activeView']) => void;
  onOpenAddModal: (type: 'slot' | 'task' | 'course') => void;
  onOpenHolidays?: () => void;
}

export function LiveHero({
  user,
  state,
  onMarkAttendance,
  onViewChange,
  onOpenAddModal,
  onOpenHolidays,
}: LiveHeroProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifiedSlots, setNotifiedSlots] = useState<Set<string>>(new Set());
  const [chimedSlots, setChimedSlots] = useState<Set<string>>(new Set());
  const [chimeEnabled, setChimeEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('academiasync_chime_enabled') !== 'false';
    } catch {
      return true;
    }
  });

  const toggleChime = () => {
    const nextVal = !chimeEnabled;
    setChimeEnabled(nextVal);
    try {
      localStorage.setItem('academiasync_chime_enabled', String(nextVal));
    } catch {}
    if (nextVal) {
      playCampusBellChime();
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const theme = THEMES[state.theme] || THEMES['dark-slate'];
  const status = getCurrentAndNextClass(state.timeSlots, state.courses, currentTime, user.semesterStartDate, state.holidays, state.scheduleOverrides);

  // Background reminder notifications for upcoming lectures (<= 10 mins before class)
  useEffect(() => {
    if (status.nextSlot && status.nextCourse && status.timeUntilNext > 0 && status.timeUntilNext <= 10) {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const notifyKey = `${status.nextSlot.id}_${todayDateStr}`;
      if (!notifiedSlots.has(notifyKey)) {
        setNotifiedSlots((prev) => new Set(prev).add(notifyKey));
        sendAppNotification(
          `Upcoming Lecture in ${status.timeUntilNext} min: ${status.nextCourse.code}`,
          `${status.nextCourse.name} starts at ${formatTime12h(status.nextSlot.startTime)} (${status.nextSlot.room || 'Room TBA'})`
        );
      }
    }
  }, [status.nextSlot, status.nextCourse, status.timeUntilNext, notifiedSlots]);

  // Audio Campus Bell Chime (<= 5 mins before class)
  useEffect(() => {
    if (chimeEnabled && status.nextSlot && status.timeUntilNext > 0 && status.timeUntilNext <= 5) {
      const todayDateStr = new Date().toISOString().split('T')[0];
      const chimeKey = `${status.nextSlot.id}_${todayDateStr}`;
      if (!chimedSlots.has(chimeKey)) {
        setChimedSlots((prev) => new Set(prev).add(chimeKey));
        playCampusBellChime();
      }
    }
  }, [chimeEnabled, status.nextSlot, status.timeUntilNext, chimedSlots]);

  // Quick stats
  const pendingTasks = state.tasks.filter((t) => t.status !== 'completed');
  const urgentTasks = pendingTasks.filter((t) => t.priority === 'urgent' || t.priority === 'high');

  // Overall attendance calculation
  const collegeMin = user.collegeMinAttendance || user.targetAttendance || 75;
  const personalGoal = user.personalGoalAttendance || collegeMin;
  const totalClasses = state.courses.reduce((acc, c) => acc + (c.totalClasses || 0), 0);
  const totalAttended = state.courses.reduce((acc, c) => acc + (c.attendedClasses || 0), 0);
  const overallPercentage = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 1000) / 10 : 100;
  const isOverallSafe = overallPercentage >= personalGoal;

  const handleQuickPresent = (courseId: string) => {
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7 },
    });
    const multiplier = status.currentSlot ? getSlotDurationMultiplier(status.currentSlot) : 1;
    onMarkAttendance(courseId, 'present', undefined, undefined, undefined, multiplier);
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const activeClassLoggedToday = status.currentCourse
    ? state.attendanceRecords.find((r) => r.courseId === status.currentCourse!.id && r.date === todayStr)
    : null;

  const isBeforeTermStart = user.semesterStartDate && todayStr < user.semesterStartDate;
  const daysUntilTermStart = user.semesterStartDate
    ? Math.ceil((new Date(user.semesterStartDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const todayExams = (state.exams || []).filter((ex) => ex.examDate === todayStr);

  return (
    <section className="mb-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2" style={{ color: theme.textPrimary }}>
            <span>Welcome back, {user.name.split(' ')[0]}</span>
            <span className="text-xl">👋</span>
          </h1>
          <p className="text-sm font-medium mt-1" style={{ color: theme.textSecondary }}>
            {user.branch} • {user.semester} • Target: {personalGoal}% Goal (Min: {collegeMin}%)
          </p>
        </div>

        {/* Quick controls & overall attendance chip */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={toggleChime}
            className={`p-2.5 rounded-2xl border transition-all flex items-center gap-1.5 text-xs font-bold ${
              chimeEnabled
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-white/5 border-white/10 text-slate-400'
            }`}
            title={chimeEnabled ? 'Campus chime active (5m before class). Click to mute.' : 'Campus chime muted. Click to enable audio chime.'}
          >
            {chimeEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{chimeEnabled ? 'Chime On' : 'Chime Off'}</span>
          </button>

          {onOpenHolidays && (
            <button
              onClick={onOpenHolidays}
              className="p-2.5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5"
              title="Manage Institutional Holidays & Recess"
            >
              <Palmtree className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Breaks</span>
            </button>
          )}

          <div 
            className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl border cursor-pointer transition-transform hover:scale-[1.02]"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
            }}
            onClick={() => onViewChange('attendance')}
          >
            <div className="relative flex items-center justify-center">
              <span className={`text-base font-extrabold ${state.courses.length === 0 ? 'text-slate-400' : isOverallSafe ? 'text-emerald-400' : 'text-rose-400'}`}>
                {state.courses.length === 0 ? '--' : `${overallPercentage}%`}
              </span>
            </div>
            <div className="text-left">
              <p className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: theme.textSecondary }}>
                Overall Attendance
              </p>
              <p className={`text-xs font-bold ${state.courses.length === 0 ? 'text-slate-400' : isOverallSafe ? 'text-emerald-400' : 'text-rose-400'}`}>
                {state.courses.length === 0 ? 'No courses added' : isOverallSafe ? '✓ Above Safe Goal' : '⚠ Below Target Goal'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Campus Holiday / Academic Recess Banner */}
      {status.isHoliday && (
        <div className="mb-5 p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Palmtree className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🌴 Campus Holiday / Recess: {status.holidayTitle}</span>
              </h4>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Class lectures, tracking alarms, and bunk counters are paused for today. Enjoy your break!
              </p>
            </div>
          </div>
          {onOpenHolidays && (
            <button
              onClick={onOpenHolidays}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors shrink-0"
            >
              View Calendar
            </button>
          )}
        </div>
      )}

      {/* Classes Commencement Countdown Banner (If term hasn't started yet) */}
      {isBeforeTermStart && (
        <div className="mb-5 p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                Classes Start in {daysUntilTermStart} Day{daysUntilTermStart === 1 ? '' : 's'}
                <span className="text-[10px] font-mono font-normal px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300">
                  {user.semesterStartDate}
                </span>
              </h4>
              <p className="text-xs text-slate-400">
                Timetable and attendance tracking are calibrated and ready to activate on Day 1.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Day Order Swap Live Alert */}
      {status.isScheduleOverride && (
        <div className="mb-5 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
              🔄
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                Day Order Swap Active: Running {status.overrideDayName}'s Timetable
              </h4>
              <p className="text-xs text-slate-300">
                {status.overrideReason ? `Reason: ${status.overrideReason}` : 'Today is running an alternate day timetable order for holiday compensation.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Live University Exam Alerts Banner */}
      {todayExams.map((ex) => (
        <div 
          key={ex.id}
          onClick={() => onViewChange('exams')}
          className="mb-5 p-4 rounded-2xl bg-rose-950/40 border border-rose-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl cursor-pointer hover:bg-rose-950/60 transition-all"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 font-black animate-pulse">
              🚨
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-rose-500/30 text-rose-300 border border-rose-500/30">
                  {ex.examCategory.toUpperCase()} {ex.examType.toUpperCase()} EXAM TODAY
                </span>
                {ex.startTime && (
                  <span className="text-xs font-mono font-bold text-amber-400">
                    🕒 {formatTime12h(ex.startTime)} {ex.endTime ? `- ${formatTime12h(ex.endTime)}` : ''}
                  </span>
                )}
              </div>
              <h4 className="text-base font-extrabold text-white mt-0.5">
                {ex.title}
              </h4>
              {ex.roomOrLab && (
                <p className="text-xs text-rose-200 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-rose-400" />
                  Venue / Lab: {ex.roomOrLab}
                </p>
              )}
            </div>
          </div>
          <button className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500 text-white shadow hover:bg-rose-600 transition-all self-end sm:self-center">
            Open Exam Hub →
          </button>
        </div>
      ))}

      {/* Main Grid: Live Class Card (Left) & Upcoming / Action Cards (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Active Class or Free Period Card (2 cols on large) */}
        <div 
          className="lg:col-span-2 rounded-3xl p-6 sm:p-7 border relative overflow-hidden flex flex-col justify-between shadow-xl"
          style={{
            backgroundColor: theme.cardBg,
            borderColor: status.currentSlot ? theme.accent : theme.cardBorder,
            boxShadow: status.currentSlot ? `0 10px 30px -10px ${theme.accentGlow}` : undefined,
          }}
        >
          {/* Background Ambient Glow */}
          <div 
            className="absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl pointer-events-none opacity-20"
            style={{ backgroundColor: status.currentCourse ? status.currentCourse.color : theme.accent }}
          />

          <div>
            {/* Header Badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {status.currentSlot ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    LIVE CLASS IN SESSION
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <Coffee className="w-3.5 h-3.5" />
                    {state.timeSlots.length === 0 ? 'TIMETABLE READY FOR SETUP' : 'FREE TIME / STUDY BREAK'}
                  </span>
                )}
                {status.currentSlot && (
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-white/10" style={{ color: theme.textSecondary }}>
                    {status.currentSlot.type}
                  </span>
                )}
              </div>

              {status.currentSlot && (
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/40 border border-amber-500/30 px-3 py-1 rounded-full">
                  ⏳ {status.minutesRemaining}m left
                </span>
              )}
            </div>

            {/* Course Title & Details */}
            {status.currentSlot && status.currentCourse ? (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: status.currentCourse.color }}
                  />
                  <span className="text-sm font-mono font-bold text-indigo-400">
                    {status.currentCourse.code}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1" style={{ color: theme.textPrimary }}>
                  {status.currentCourse.name}
                </h2>

                {/* Location & Professor Pills */}
                <div className="flex flex-wrap items-center gap-4 mt-4 text-xs font-medium" style={{ color: theme.textSecondary }}>
                  <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                    <MapPin className="w-4 h-4 text-rose-400" />
                    {status.currentSlot.room || status.currentCourse.defaultRoom || 'Classroom'}
                  </span>
                  {status.currentCourse.professor && (
                    <span className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                      <UserIcon className="w-4 h-4 text-sky-400" />
                      {status.currentCourse.professor}
                    </span>
                  )}
                  <span className="bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 font-mono">
                    🕒 {formatTime12h(status.currentSlot.startTime)} - {formatTime12h(status.currentSlot.endTime)}
                  </span>
                </div>

                {/* Progress Bar for Current Lecture */}
                <div className="mt-5">
                  <div className="flex justify-between text-[11px] font-semibold mb-1" style={{ color: theme.textSecondary }}>
                    <span>Lecture Progress</span>
                    <span>{status.progressPercent}% Completed</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${status.progressPercent}%`, 
                        backgroundColor: status.currentCourse.color 
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : state.courses.length === 0 ? (
              <div className="py-4 text-left">
                <h2 className="text-xl sm:text-2xl font-bold" style={{ color: theme.textPrimary }}>
                  Your Academic Dashboard is Ready!
                </h2>
                <p className="text-xs sm:text-sm mt-1.5 max-w-lg" style={{ color: theme.textSecondary }}>
                  Start by registering your semester subjects below to customize your schedule, track deadlines, and monitor your attendance criteria.
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => onOpenAddModal('course')}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all hover:scale-105"
                    style={{ backgroundColor: theme.accent }}
                  >
                    <Plus className="w-3.5 h-3.5 inline mr-1" />
                    Register a Course
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-4 text-left">
                <h2 className="text-xl sm:text-2xl font-bold" style={{ color: theme.textPrimary }}>
                  {status.nextSlot ? 'No lecture happening right now' : 'All classes done for today! 🎉'}
                </h2>
                <p className="text-xs sm:text-sm mt-1.5 max-w-lg" style={{ color: theme.textSecondary }}>
                  {status.nextSlot && status.nextCourse
                    ? `Your next class is ${status.nextCourse.name} starting in ${status.timeUntilNext} minutes.`
                    : 'You have no more scheduled lectures today. Great time to knock out your pending assignments!'}
                </p>
              </div>
            )}
          </div>

          {/* Quick 1-Tap Attendance Action (If current class exists) */}
          {status.currentSlot && status.currentCourse && (
            <div className="mt-6 pt-5 border-t flex flex-wrap items-center justify-between gap-3"
              style={{ borderColor: theme.cardBorder }}
            >
              <div className="text-xs">
                <span className="font-semibold" style={{ color: theme.textSecondary }}>Current Course Attendance: </span>
                <span className="font-bold text-white">
                  {calculateAttendance(status.currentCourse, collegeMin, personalGoal).percentage}%
                </span>
                <span className="text-slate-400 ml-1">
                  ({status.currentCourse.attendedClasses}/{status.currentCourse.totalClasses} attended)
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {activeClassLoggedToday ? (
                  <span className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
                    activeClassLoggedToday.status === 'present'
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                      : activeClassLoggedToday.status === 'cancelled'
                      ? 'bg-slate-800/80 text-slate-300 border-slate-600/40'
                      : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                  }`}>
                    <CheckCircle2 className="w-4 h-4" />
                    Today: {activeClassLoggedToday.status === 'present' ? 'Present ✓' : activeClassLoggedToday.status === 'cancelled' ? 'Not Conducted ⚪' : 'Missed ✕'}
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => handleQuickPresent(status.currentCourse!.id)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition-all hover:scale-105 active:scale-95"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Present
                    </button>
                    <button
                      onClick={() => {
                        const multiplier = status.currentSlot ? getSlotDurationMultiplier(status.currentSlot) : 1;
                        onMarkAttendance(status.currentCourse!.id, 'absent', undefined, undefined, undefined, multiplier);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 bg-white/10 hover:bg-rose-600/30 hover:text-rose-300 transition-all"
                    >
                      <XCircle className="w-4 h-4" />
                      Missed / Bunk
                    </button>
                    <button
                      onClick={() => {
                        const multiplier = status.currentSlot ? getSlotDurationMultiplier(status.currentSlot) : 1;
                        onMarkAttendance(status.currentCourse!.id, 'cancelled', undefined, undefined, undefined, multiplier);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 bg-white/10 hover:bg-slate-700/60 hover:text-white transition-all"
                      title="Class not conducted due to half day, holiday, or faculty leave (0 safe bunk penalty)"
                    >
                      ⚪ Not Conducted
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: "Up Next" Card & Pending Tasks Snapshot */}
        <div className="flex flex-col gap-4">
          
          {/* Up Next Preview Card */}
          <div 
            className="rounded-3xl p-5 border shadow-lg flex-1 flex flex-col justify-between"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
            }}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Up Next Today
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => requestNotificationPermission()}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Enable background class reminder alerts"
                  >
                    <Bell className="w-3.5 h-3.5" />
                  </button>
                  {status.nextSlot && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-950/40 text-sky-400 border border-sky-500/20">
                      in {status.timeUntilNext}m
                    </span>
                  )}
                </div>
              </div>

              {status.nextSlot && status.nextCourse ? (
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.nextCourse.color }} />
                    <span className="text-xs font-mono font-semibold" style={{ color: theme.textSecondary }}>
                      {status.nextCourse.code} • {status.nextSlot.type}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold mt-1" style={{ color: theme.textPrimary }}>
                    {status.nextCourse.name}
                  </h3>
                  <div className="flex items-center gap-3 mt-3 text-xs" style={{ color: theme.textSecondary }}>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      {status.nextSlot.room || status.nextCourse.defaultRoom || 'Room TBA'}
                    </span>
                    <span>🕒 {formatTime12h(status.nextSlot.startTime)}</span>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <CalendarCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>
                    {state.timeSlots.length === 0 ? 'No lectures scheduled' : 'No more classes today'}
                  </p>
                  <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                    {state.timeSlots.length === 0
                      ? 'Add your weekly timetable slots to get automatic class alerts.'
                      : 'Check your weekly timetable or prepare for tomorrow.'}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => onViewChange('timetable')}
              className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-colors hover:bg-white/10"
              style={{
                borderColor: theme.cardBorder,
                color: theme.textPrimary,
              }}
            >
              View Full Timetable <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Urgent Deadlines Snapshot */}
          <div 
            className="rounded-3xl p-5 border shadow-lg cursor-pointer transition-transform hover:scale-[1.01]"
            style={{
              backgroundColor: theme.cardBg,
              borderColor: theme.cardBorder,
            }}
            onClick={() => onViewChange('tasks')}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Urgent Tasks & Deadlines
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                {urgentTasks.length} Due Soon
              </span>
            </div>

            {urgentTasks.length > 0 ? (
              <div className="space-y-2 mt-2">
                {urgentTasks.slice(0, 2).map((t) => (
                  <div key={t.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5 text-left">
                    <p className="text-xs font-bold truncate" style={{ color: theme.textPrimary }}>
                      {t.title}
                    </p>
                    <p className="text-[10px] mt-0.5 text-amber-400 font-medium">
                      📅 Due: {t.dueDate} {t.dueTime ? `at ${formatTime12h(t.dueTime)}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs mt-2" style={{ color: theme.textSecondary }}>
                {state.tasks.length === 0 ? 'No tasks created yet. Click + Add to track assignments.' : 'All clear! No urgent assignments due.'}
              </p>
            )}
          </div>

        </div>

      </div>
    </section>
  );
}
