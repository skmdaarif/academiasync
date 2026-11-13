import { useState, useMemo } from 'react';
import { Course, StudentData, AttendanceStatus, UserAccount } from '../types';
import { THEMES } from '../styles/themes';
import { calculateAttendance, getRemainingClassesForCourse } from '../utils/timeUtils';
import { 
  PieChart, 
  ShieldCheck, 
  AlertTriangle, 
  Plus, 
  Minus, 
  RotateCcw,
  Sparkles,
  Sliders,
  Target,
  Award,
  Building,
  Check,
  Trash2,
  X,
  Edit3,
  BookOpen,
  Calendar,
  FlaskConical,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AttendanceCalculatorProps {
  user: UserAccount;
  state: StudentData;
  onUpdateUser?: (user: UserAccount) => void;
  onUpdateCourse: (course: Course) => void;
  onDeleteCourse?: (courseId: string) => void;
  onUpdateGoals: (collegeMin: number, personalGoal: number) => void;
  onMarkAttendance: (courseId: string, status: AttendanceStatus) => void;
  onUndoAttendance?: (courseId: string) => void;
  onOpenAddCourse?: () => void;
  onOpenHistory?: () => void;
}

const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#84cc16', // Lime
  '#6366f1', // Indigo
];

export function AttendanceCalculator({
  user,
  state,
  onUpdateUser,
  onUpdateCourse,
  onDeleteCourse,
  onUpdateGoals,
  onMarkAttendance,
  onUndoAttendance,
  onOpenAddCourse,
  onOpenHistory,
}: AttendanceCalculatorProps) {
  const collegeMin = user.collegeMinAttendance || user.targetAttendance || 75;
  const personalGoal = user.personalGoalAttendance || collegeMin;

  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [customGoalInput, setCustomGoalInput] = useState<number>(personalGoal);
  const [goalSavedFeedback, setGoalSavedFeedback] = useState(false);
  const [goalError, setGoalError] = useState('');
  const [simulatingCourseId, setSimulatingCourseId] = useState<string | null>(null);
  const [simulatedBunks, setSimulatedBunks] = useState<Record<string, number>>({});

  const [editingClassesEnd, setEditingClassesEnd] = useState(false);
  const [tempClassesEnd, setTempClassesEnd] = useState(user.classesEndDate || '');
  const [showBulkMatrix, setShowBulkMatrix] = useState(false);
  const [bulkBaselines, setBulkBaselines] = useState<Record<string, { held: number; attended: number }>>({});
  const [bulkMatrixSaving, setBulkMatrixSaving] = useState(false);

  const theme = THEMES[state.theme] || THEMES['dark-slate'];

  const handleSaveCustomGoal = (newGoal: number) => {
    setGoalError('');
    if (newGoal < collegeMin) {
      setGoalError(`Personal goal cannot be lower than your college requirement of ${collegeMin}%.`);
      return;
    }
    if (newGoal > 100) {
      setGoalError('Goal cannot exceed 100%.');
      return;
    }

    setCustomGoalInput(newGoal);
    onUpdateGoals(collegeMin, newGoal);
    setGoalSavedFeedback(true);
    setTimeout(() => setGoalSavedFeedback(false), 2000);
  };

  const analyzedCourses = useMemo(() => {
    return state.courses.map((course) => {
      const remainingClasses = getRemainingClassesForCourse(
        course.id,
        state.timeSlots,
        new Date(),
        user.classesEndDate,
        state.holidays,
        state.scheduleOverrides
      );
      const analysis = calculateAttendance(
        course,
        collegeMin,
        personalGoal,
        remainingClasses,
        user.classesEndDate
      );
      return { course, analysis, remainingClasses };
    });
  }, [state.courses, state.timeSlots, user.classesEndDate, state.holidays, state.scheduleOverrides, collegeMin, personalGoal]);

  const debarmentRiskCourses = analyzedCourses.filter(
    (c) => c.analysis.severityLevel === 'debarment_risk' || c.analysis.severityLevel === 'college_warning'
  );
  const goalAlertCourses = analyzedCourses.filter(
    (c) => c.analysis.isCollegeSafe && (c.analysis.severityLevel === 'goal_unreachable' || c.analysis.severityLevel === 'goal_warning')
  );

  if (state.courses.length === 0) {
    return (
      <div 
        className="rounded-3xl p-10 text-center border shadow-xl"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
        }}
      >
        <PieChart className="w-12 h-12 text-indigo-400 mx-auto mb-3 opacity-80" />
        <h3 className="text-lg font-bold" style={{ color: theme.textPrimary }}>
          No Attendance Records Yet
        </h3>
        <p className="text-xs sm:text-sm max-w-sm mx-auto mt-1" style={{ color: theme.textSecondary }}>
          Register your semester courses to start tracking attended lectures, calculate safe bunks, and monitor your personal {personalGoal}% target.
        </p>
        {onOpenAddCourse && (
          <button
            onClick={onOpenAddCourse}
            className="mt-5 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md hover:scale-105 transition-all"
            style={{ backgroundColor: theme.accent }}
          >
            <Plus className="w-4 h-4 inline mr-1" />
            Register Course to Track Attendance
          </button>
        )}
      </div>
    );
  }

  // Overall attendance calculation
  const totalClasses = state.courses.reduce((acc, c) => acc + (c.totalClasses || 0) + (c.baselineClassesHeld || 0), 0);
  const totalAttended = state.courses.reduce((acc, c) => acc + (c.attendedClasses || 0) + (c.baselineAttendedClasses || 0), 0);
  const overallPercentage = totalClasses > 0 
    ? Math.round((totalAttended / totalClasses) * 1000) / 10 
    : (user.initialAttendancePct !== undefined ? user.initialAttendancePct : 100);
  
  const isCollegeSafe = overallPercentage >= collegeMin;
  const isPersonalGoalMet = overallPercentage >= personalGoal;

  const handleQuickAdd = (course: Course, type: AttendanceStatus) => {
    if (type === 'present') {
      confetti({ particleCount: 35, spread: 50, origin: { y: 0.7 } });
    }
    onMarkAttendance(course.id, type);
  };

  const handleUndo = (course: Course) => {
    if (course.totalClasses <= 0) return;
    if (onUndoAttendance) {
      onUndoAttendance(course.id);
    } else {
      const newAttended = Math.max(0, course.attendedClasses - 1);
      const newTotal = Math.max(0, course.totalClasses - 1);
      onUpdateCourse({
        ...course,
        totalClasses: newTotal,
        attendedClasses: newAttended,
      });
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;
    onUpdateCourse(editingCourse);
    setEditingCourse(null);
  };

  const openBulkMatrix = () => {
    const initial: Record<string, { held: number; attended: number }> = {};
    for (const c of state.courses) {
      initial[c.id] = {
        held: c.baselineClassesHeld ?? 0,
        attended: c.baselineAttendedClasses ?? 0,
      };
    }
    setBulkBaselines(initial);
    setShowBulkMatrix(true);
  };

  const handleSaveBulkMatrix = () => {
    setBulkMatrixSaving(true);
    try {
      for (const c of state.courses) {
        const entry = bulkBaselines[c.id];
        if (entry) {
          const held = Math.max(0, entry.held);
          const attended = Math.min(held, Math.max(0, entry.attended));
          if (held !== c.baselineClassesHeld || attended !== c.baselineAttendedClasses) {
            onUpdateCourse({
              ...c,
              baselineClassesHeld: held,
              baselineAttendedClasses: attended,
            });
          }
        }
      }
      setShowBulkMatrix(false);
    } finally {
      setBulkMatrixSaving(false);
    }
  };

  const handleApplyBulkPercentage = (pct: number) => {
    const updated = { ...bulkBaselines };
    for (const c of state.courses) {
      const curHeld = updated[c.id]?.held || 30;
      const held = curHeld > 0 ? curHeld : 30;
      const attended = Math.round(held * (pct / 100));
      updated[c.id] = { held, attended };
    }
    setBulkBaselines(updated);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Dual Metrics & Personal Goal Assigner */}
      <div className="rounded-3xl p-6 sm:p-8 border shadow-xl relative overflow-hidden"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          
          {/* Circular Percentage Meter */}
          <div className="flex items-center gap-5">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-white/10"
                  fill="transparent"
                />
                <circle
                  cx="56"
                  cy="56"
                  r="46"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeDasharray={289}
                  strokeDashoffset={289 - (289 * Math.min(100, overallPercentage)) / 100}
                  strokeLinecap="round"
                  className={isPersonalGoalMet ? 'text-emerald-400' : isCollegeSafe ? 'text-amber-400' : 'text-rose-400'}
                  fill="transparent"
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black" style={{ color: theme.textPrimary }}>
                  {overallPercentage}%
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-400">Current</span>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {isPersonalGoalMet ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-500/30">
                    <Award className="w-3.5 h-3.5" />
                    Personal Goal ({personalGoal}%) Met
                  </span>
                ) : isCollegeSafe ? (
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-500/30">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    College Safe (Goal: {personalGoal}%)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold text-rose-400 bg-rose-950/40 px-2.5 py-1 rounded-full border border-rose-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Below College Min ({collegeMin}%)
                  </span>
                )}
              </div>
              <p className="text-xs mt-2 text-slate-300 font-medium">
                Attended <strong className="text-white">{totalAttended}</strong> of <strong className="text-white">{totalClasses}</strong> Total Classes
              </p>
            </div>
          </div>

          {/* Dual Criteria Status Box */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-sky-400" />
                College Requirement:
              </span>
              <span className="font-bold font-mono text-white">
                {collegeMin}% Min
              </span>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                Your Custom Target Goal:
              </span>
              <span className="font-bold font-mono text-amber-400">
                {personalGoal}%
              </span>
            </div>

            <p className="text-[11px] text-slate-400 pt-1 border-t border-white/5">
              {isPersonalGoalMet
                ? `🔥 Excellent! Your attendance exceeds your personal ${personalGoal}% standard.`
                : isCollegeSafe
                ? `👍 You are safe from college debarment (${collegeMin}%), working towards your ${personalGoal}% target.`
                : `⚠️ Action needed: Attend consecutive classes to restore college eligibility.`}
            </p>
          </div>

          {/* PERSONAL ATTENDANCE GOAL ASSIGNER (Custom Inside WebApp) */}
          <div className="p-4 rounded-2xl bg-white/5 border border-indigo-500/30 relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Target className="w-4 h-4 text-amber-400" />
                Personal Goal Assigner
              </span>
              <span className="text-[10px] text-slate-400">
                Min: {collegeMin}%
              </span>
            </div>

            {/* Slider with constraint: min = collegeMin */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={collegeMin}
                  max="100"
                  step="1"
                  value={customGoalInput}
                  onChange={(e) => setCustomGoalInput(Number(e.target.value))}
                  className="flex-1 accent-indigo-500 cursor-pointer"
                />
                <span className="w-12 px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-center font-mono font-bold text-xs text-amber-400">
                  {customGoalInput}%
                </span>
              </div>

              {/* Quick Presets (all >= collegeMin) */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {[80, 85, 90, 95].filter((p) => p >= collegeMin).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setCustomGoalInput(p);
                      handleSaveCustomGoal(p);
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                      personalGoal === p
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {p}%
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => handleSaveCustomGoal(customGoalInput)}
                  className="ml-auto px-3 py-1 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition-all flex items-center gap-1"
                >
                  {goalSavedFeedback ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : null}
                  {goalSavedFeedback ? 'Saved!' : 'Set Goal'}
                </button>
              </div>

              {goalError && (
                <p className="text-[10px] font-semibold text-rose-400 mt-1">
                  ⚠️ {goalError}
                </p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Overview Critical & Goal Alert Banners */}
      {(debarmentRiskCourses.length > 0 || goalAlertCourses.length > 0) && (
        <div className="space-y-3">
          {debarmentRiskCourses.length > 0 && (
            <div className="p-4 rounded-2xl bg-rose-950/50 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-3 shadow-lg shadow-rose-950/20 animate-in fade-in duration-300">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-rose-100 flex items-center gap-2">
                  <span>Debarment Warning / College Shortage</span>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] uppercase font-mono">
                    {debarmentRiskCourses.length} {debarmentRiskCourses.length === 1 ? 'Course' : 'Courses'}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Attendance in <strong className="text-rose-300 font-mono">{debarmentRiskCourses.map((c) => c.course.code).join(', ')}</strong> is below your institution's {collegeMin}% minimum requirement. Immediate class attendance or OD/Medical documentation is required to avoid debarment.
                </p>
              </div>
            </div>
          )}

          {goalAlertCourses.length > 0 && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3 shadow-lg shadow-amber-950/10 animate-in fade-in duration-300">
              <Target className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-amber-100 flex items-center gap-2">
                  <span>Personal Goal Advisory</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] uppercase font-mono">
                    {goalAlertCourses.length} {goalAlertCourses.length === 1 ? 'Course' : 'Courses'}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  You are safe from college debarment (≥ {collegeMin}%), but <strong className="text-amber-300 font-mono">{goalAlertCourses.map((c) => c.course.code).join(', ')}</strong> {goalAlertCourses.length === 1 ? 'is' : 'are'} trailing your personal {personalGoal}% target. Check remaining lecture trajectories below to get back on track.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header and History Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h3 className="text-lg font-bold" style={{ color: theme.textPrimary }}>
            Course-by-Course Attendance Breakdown
          </h3>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <p className="text-xs text-slate-400">
              Real-time safe bunk thresholds & attendance logs.
            </p>
            <div className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-slate-300">
              <span className="text-slate-400">📅 Classes End:</span>
              {editingClassesEnd ? (
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={tempClassesEnd}
                    onChange={(e) => setTempClassesEnd(e.target.value)}
                    className="px-1.5 py-0.5 bg-black/40 border border-white/20 rounded text-[11px] text-white focus:outline-none"
                  />
                  <button
                    onClick={() => {
                      if (onUpdateUser) {
                        onUpdateUser({ ...user, classesEndDate: tempClassesEnd || undefined });
                      }
                      setEditingClassesEnd(false);
                    }}
                    className="px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-bold"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingClassesEnd(false)}
                    className="text-slate-400 hover:text-white text-[10px]"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setTempClassesEnd(user.classesEndDate || '');
                    setEditingClassesEnd(true);
                  }}
                  className="font-mono font-bold text-amber-400 hover:underline flex items-center gap-1"
                  title="Click to edit tentative last date of regular classes"
                >
                  {user.classesEndDate || 'Not set'}
                  <Edit3 className="w-2.5 h-2.5 text-slate-400" />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openBulkMatrix}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 transition-all flex items-center gap-1.5 shadow-sm"
            title="Calibrate individual ERP portal attendance figures per subject"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            ⚡ Calibrate Subject Baselines
          </button>

          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-200 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1.5 shadow-sm"
              title="Open full attendance records history"
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              Attendance Logs ({state.attendanceRecords?.length || 0})
            </button>
          )}

          {onOpenAddCourse && (
            <button
              onClick={onOpenAddCourse}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-1.5"
              style={{ backgroundColor: theme.accent }}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Course
            </button>
          )}
        </div>
      </div>

      {/* Course-by-Course Attendance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {state.courses.map((course) => {
          const remainingClasses = getRemainingClassesForCourse(
            course.id,
            state.timeSlots,
            new Date(),
            user.classesEndDate,
            state.holidays,
            state.scheduleOverrides
          );
          const analysis = calculateAttendance(
            course,
            collegeMin,
            personalGoal,
            remainingClasses,
            user.classesEndDate
          );

          return (
            <div
              key={course.id}
              className="rounded-3xl p-5 border shadow-lg flex flex-col justify-between relative overflow-hidden transition-all hover:translate-y-[-2px]"
              style={{
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
              }}
            >
              {/* Left Accent Bar */}
              <div 
                className="absolute left-0 top-0 bottom-0 w-2"
                style={{ backgroundColor: course.color }}
              />

              <div className="pl-2">
                {/* Course Header */}
                <div className="flex items-center justify-between mb-2">
                  <span 
                    className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold text-white shadow-sm"
                    style={{ backgroundColor: course.color }}
                  >
                    {course.code}
                  </span>
                  <div className="text-right">
                    <span className="text-xs font-bold font-mono" style={{ color: analysis.isPersonalGoalMet ? '#34d399' : analysis.isCollegeSafe ? '#fbbf24' : '#f87171' }}>
                      {analysis.percentage}%
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-base line-clamp-1" style={{ color: theme.textPrimary }}>
                  {course.name}
                </h3>
                {course.professor && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {course.professor}
                  </p>
                )}

                {/* Course Resource Links & Cabin */}
                {(course.driveFolderLink || course.syllabusUrl || course.professorEmail || course.cabinRoom) && (
                  <div className="flex items-center gap-1.5 mt-2.5 flex-wrap text-[11px]">
                    {course.driveFolderLink && (
                      <a
                        href={course.driveFolderLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition-colors"
                        title="Open Course Drive / LMS Folder"
                      >
                        📁 Drive
                      </a>
                    )}
                    {course.syllabusUrl && (
                      <a
                        href={course.syllabusUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 transition-colors"
                        title="Open Course Syllabus"
                      >
                        📄 Syllabus
                      </a>
                    )}
                    {course.professorEmail && (
                      <a
                        href={`mailto:${course.professorEmail}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 transition-colors"
                        title={`Email ${course.professor || 'Professor'}`}
                      >
                        ✉️ Email
                      </a>
                    )}
                    {course.cabinRoom && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 text-slate-300 border border-white/10">
                        🚪 Cabin: {course.cabinRoom}
                      </span>
                    )}
                  </div>
                )}

                {/* Progress Bar with Dual Markers */}
                <div className="mt-4">
                  <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 mb-1">
                    <span>
                      {(course.attendedClasses || 0) + (course.baselineAttendedClasses || 0)} / {(course.totalClasses || 0) + (course.baselineClassesHeld || 0)} attended
                      {Boolean((course.baselineClassesHeld || 0) > 0) && (
                        <span className="text-[10px] text-indigo-400 font-normal ml-1">
                          (incl. {course.baselineClassesHeld} baseline)
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-slate-400">Min: <strong className="text-slate-200">{collegeMin}%</strong></span>
                      <span className="text-slate-600">•</span>
                      <span className="text-amber-400 font-bold">Goal: {analysis.effectivePersonalGoal}%</span>
                    </span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-white/10 relative overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        analysis.isPersonalGoalMet ? 'bg-emerald-500' : analysis.isCollegeSafe ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, analysis.percentage)}%` }}
                    />
                    {/* Visual threshold line for college minimum */}
                    {collegeMin < 100 && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-white/60 pointer-events-none"
                        style={{ left: `${collegeMin}%` }}
                        title={`College Minimum (${collegeMin}%)`}
                      />
                    )}
                  </div>
                </div>

                {/* Bunk status badge */}
                <div className="mt-3 space-y-2">
                  <div className={`p-2.5 rounded-xl text-xs font-semibold border ${analysis.badgeColor}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold flex items-center gap-1">
                        {analysis.isPersonalGoalMet ? '🎯' : analysis.isCollegeSafe ? '⚠️' : '🚨'}
                        {analysis.statusText}
                      </span>
                    </div>

                    {/* Secondary safety net context when personal goal differs from college min */}
                    {analysis.effectivePersonalGoal > collegeMin && (
                      <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between text-[11px] font-normal text-slate-300">
                        <span className="flex items-center gap-1 text-slate-400">
                          🛡️ College Debarment Limit ({collegeMin}%):
                        </span>
                        <span>
                          {analysis.isCollegeSafe ? (
                            analysis.collegeSafeBunks > 0 ? (
                              <span className="text-emerald-300 font-semibold">Can miss up to {analysis.collegeSafeBunks} classes</span>
                            ) : (
                              <span className="text-amber-300 font-semibold">Borderline (Attend next)</span>
                            )
                          ) : (
                            <span className="text-rose-300 font-semibold">Short by {analysis.classesNeededForCollege} classes</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                  {(analysis.collegeProjectionSummary || analysis.goalProjectionSummary) ? (
                    <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5 text-[11px] space-y-1.5 leading-snug">
                      <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
                        <span className="flex items-center gap-1 text-indigo-300">
                          <Calendar className="w-3 h-3" />
                          Term-End Forecast
                        </span>
                        <span className="font-mono text-slate-400">
                          {analysis.remainingClasses} classes left
                        </span>
                      </div>
                      {analysis.collegeProjectionSummary && (
                        <div className={`p-1.5 rounded-lg border text-[11px] ${
                          analysis.isDebarmentInevitable 
                            ? 'bg-rose-950/40 border-rose-500/30 text-rose-300 font-semibold' 
                            : !analysis.isCollegeSafe
                            ? 'bg-amber-950/40 border-amber-500/30 text-amber-300'
                            : 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300'
                        }`}>
                          {analysis.collegeProjectionSummary}
                        </div>
                      )}
                      {analysis.goalProjectionSummary && (
                        <div className={`p-1.5 rounded-lg border text-[11px] ${
                          analysis.isPersonalGoalUnreachable
                            ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                            : !analysis.isPersonalGoalMet
                            ? 'bg-amber-950/30 border-amber-500/20 text-amber-300'
                            : 'bg-indigo-950/30 border-indigo-500/20 text-indigo-300'
                        }`}>
                          {analysis.goalProjectionSummary}
                        </div>
                      )}
                    </div>
                  ) : analysis.projectionSummary ? (
                    <div className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/5 text-[11px] text-slate-300 leading-snug">
                      <span className="font-semibold text-indigo-300">📅 Term-End Projection: </span>
                      {analysis.projectionSummary}
                    </div>
                  ) : null}
                </div>

                {/* Interactive What-If Bunk Simulator */}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setSimulatingCourseId(simulatingCourseId === course.id ? null : course.id)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[11px] font-semibold bg-white/5 hover:bg-white/10 text-indigo-300 border border-white/5 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <FlaskConical className="w-3.5 h-3.5 text-indigo-400" />
                      What-If Bunk Simulator
                    </span>
                    {simulatingCourseId === course.id ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>

                  {simulatingCourseId === course.id && (() => {
                    const bunkCount = simulatedBunks[course.id] || 0;
                    const cTotal = (course.totalClasses || 0) + (course.baselineClassesHeld || 0);
                    const cAttended = (course.attendedClasses || 0) + (course.baselineAttendedClasses || 0);
                    const simTotal = cTotal + bunkCount;
                    const simAttended = cAttended;
                    const simPct = simTotal > 0 ? (simAttended / simTotal) * 100 : 100;
                    const drop = Math.max(0, analysis.percentage - simPct);
                    const targetRatio = collegeMin / 100;
                    const recoveryNeeded = Math.max(0, Math.ceil((targetRatio * simTotal - simAttended) / (1 - targetRatio)));

                    return (
                      <div className="mt-2 p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400">Simulate Next Bunks:</span>
                          <span className="font-bold text-amber-300 font-mono">
                            {bunkCount} Class{bunkCount === 1 ? '' : 'es'}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="10"
                          step="1"
                          value={bunkCount}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setSimulatedBunks({ ...simulatedBunks, [course.id]: val });
                          }}
                          className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-400"
                        />
                        {bunkCount > 0 ? (
                          <div className="space-y-1.5 pt-1 text-[11px]">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Resulting Attendance:</span>
                              <span className={`font-bold ${simPct >= analysis.effectivePersonalGoal ? 'text-emerald-300' : simPct >= collegeMin ? 'text-amber-300' : 'text-rose-400'}`}>
                                {simPct.toFixed(1)}% <span className="text-[10px] text-rose-400">(-{drop.toFixed(1)}%)</span>
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-300 leading-tight">
                              {simPct >= analysis.effectivePersonalGoal ? (
                                <span className="text-emerald-400">
                                  ✓ Still on track for your {analysis.effectivePersonalGoal}% personal goal and safe from college debarment ({collegeMin}%).
                                </span>
                              ) : simPct >= collegeMin ? (
                                <span className="text-amber-300">
                                  ⚠️ Drops below your {analysis.effectivePersonalGoal}% goal, but still {(simPct - collegeMin).toFixed(1)}% above the {collegeMin}% college debarment threshold.
                                </span>
                              ) : (
                                <span className="text-rose-300">
                                  🚨 Debarment Danger! Drops below {collegeMin}% college minimum. Requires attending <strong>{recoveryNeeded}</strong> consecutive class{recoveryNeeded === 1 ? '' : 'es'} to recover.
                                </span>
                              )}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 italic">
                            Slide right to test how future bunks impact your percentage.
                          </p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Quick Actions Footer */}
              <div className="mt-4 pt-3 border-t flex items-center justify-between gap-1.5 pl-2"
                style={{ borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    onClick={() => handleQuickAdd(course, 'present')}
                    className="p-1.5 rounded-lg text-xs font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/60 transition-colors flex items-center gap-1"
                    title="Mark 1 Present"
                  >
                    <Plus className="w-3 h-3" />
                    Present
                  </button>

                  <button
                    onClick={() => handleQuickAdd(course, 'absent')}
                    className="p-1.5 rounded-lg text-xs font-bold text-rose-300 bg-rose-950/40 border border-rose-500/30 hover:bg-rose-900/60 transition-colors flex items-center gap-1"
                    title="Mark 1 Absent / Bunk"
                  >
                    <Minus className="w-3 h-3" />
                    Missed
                  </button>

                  <button
                    onClick={() => handleQuickAdd(course, 'cancelled')}
                    className="p-1.5 rounded-lg text-xs font-bold text-slate-300 bg-slate-800/80 border border-slate-600/30 hover:bg-slate-700/80 transition-colors flex items-center gap-1"
                    title="Class Not Conducted / Holiday / Half-Day (0 safe bunk penalty)"
                  >
                    ⚪ Not Conducted
                  </button>

                  <button
                    onClick={() => handleQuickAdd(course, 'excused')}
                    className="p-1.5 rounded-lg text-xs font-bold text-amber-300 bg-amber-950/40 border border-amber-500/30 hover:bg-amber-900/60 transition-colors flex items-center gap-1"
                    title="Excused Absence / OD / Medical Leave (Does not lower percentage)"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    OD
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleUndo(course)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-white/5 transition-colors"
                    title="Undo last class entry"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => setEditingCourse({ ...course })}
                    className="p-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-white/5 transition-colors"
                    title="Edit counts or course-specific target"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Course & Attendance Edit Modal */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div 
            className="w-full max-w-lg rounded-3xl p-6 sm:p-7 border shadow-2xl relative my-8"
            style={{
              backgroundColor: theme.headerBg,
              borderColor: theme.cardBorder,
            }}
          >
            <button
              onClick={() => setEditingCourse(null)}
              className="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-md"
                style={{ backgroundColor: editingCourse.color || theme.accent }}
              >
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold" style={{ color: theme.textPrimary }}>
                  Edit Course: {editingCourse.code}
                </h3>
                <p className="text-xs text-slate-400">
                  Update subject details, lecture room, color badge, or attendance tallies.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Course Code *
                  </label>
                  <input
                    type="text"
                    value={editingCourse.code}
                    onChange={(e) => setEditingCourse({ ...editingCourse, code: e.target.value.toUpperCase() })}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono uppercase focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Course Name *
                  </label>
                  <input
                    type="text"
                    value={editingCourse.name}
                    onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Professor Name
                  </label>
                  <input
                    type="text"
                    value={editingCourse.professor || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, professor: e.target.value })}
                    placeholder="e.g. Dr. Turing"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Default Room
                  </label>
                  <input
                    type="text"
                    value={editingCourse.defaultRoom || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, defaultRoom: e.target.value })}
                    placeholder="e.g. Hall 301"
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Color badges */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Badge Color
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditingCourse({ ...editingCourse, color: c })}
                      className={`w-6 h-6 rounded-xl transition-transform ${
                        editingCourse.color === c ? 'scale-125 ring-2 ring-white shadow-lg' : 'hover:scale-110 opacity-70'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Classes Attended
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingCourse.attendedClasses}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        attendedClasses: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Total Classes Held
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingCourse.totalClasses}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        totalClasses: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Target Goal (%)
                  </label>
                  <input
                    type="number"
                    min={collegeMin}
                    max="100"
                    value={editingCourse.attendanceGoal || personalGoal}
                    onChange={(e) =>
                      setEditingCourse({
                        ...editingCourse,
                        attendanceGoal: Math.max(collegeMin, parseInt(e.target.value, 10) || collegeMin),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Academic Resources & Faculty Info */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Drive / LMS Folder Link
                  </label>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={editingCourse.driveFolderLink || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, driveFolderLink: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Syllabus Link / PDF URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://.../syllabus.pdf"
                    value={editingCourse.syllabusUrl || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, syllabusUrl: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Faculty Email
                  </label>
                  <input
                    type="email"
                    placeholder="prof@university.edu"
                    value={editingCourse.professorEmail || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, professorEmail: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Office / Cabin Room
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Block 2, Cabin 301"
                    value={editingCourse.cabinRoom || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, cabinRoom: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Mid-Semester ERP Baseline Calibration */}
              <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    ERP Portal Baseline (Mid-Semester Calibration)
                  </span>
                  <span className="text-[10px] text-indigo-400 font-mono">Prior to AcademiaSync</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">
                  If you joined AcademiaSync mid-semester, enter the attendance counts from your university ERP portal. Your AcademiaSync logged sessions will seamlessly build on top!
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Portal Classes Held
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingCourse.baselineClassesHeld ?? 0}
                      onChange={(e) =>
                        setEditingCourse({
                          ...editingCourse,
                          baselineClassesHeld: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-xs focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Portal Classes Attended
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingCourse.baselineAttendedClasses ?? 0}
                      onChange={(e) =>
                        setEditingCourse({
                          ...editingCourse,
                          baselineAttendedClasses: Math.max(0, parseInt(e.target.value, 10) || 0),
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="text-[10px] text-emerald-400 font-medium">
                  Effective Total: {((editingCourse.attendedClasses || 0) + (editingCourse.baselineAttendedClasses || 0))} / {((editingCourse.totalClasses || 0) + (editingCourse.baselineClassesHeld || 0))} classes
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                {onDeleteCourse && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete course ${editingCourse.code} (${editingCourse.name}) and all its timetable class slots?`)) {
                        onDeleteCourse(editingCourse.id);
                        setEditingCourse(null);
                      }
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-rose-950/30 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Course
                  </button>
                )}

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditingCourse(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md"
                    style={{ backgroundColor: theme.accent }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK BASELINE CALIBRATION MATRIX MODAL */}
      {showBulkMatrix && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div 
            className="w-full max-w-3xl rounded-3xl p-6 border shadow-2xl relative my-8"
            style={{
              backgroundColor: theme.headerBg,
              borderColor: theme.cardBorder,
            }}
          >
            <button
              onClick={() => setShowBulkMatrix(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center gap-3 mb-4">
              <div 
                className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md bg-amber-500 text-slate-950 font-black"
              >
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight" style={{ color: theme.textPrimary }}>
                  Subject ERP Attendance Calibration
                </h2>
                <p className="text-xs text-slate-400">
                  Calibrate your exact attendance figures per subject from your college ERP (e.g. 97%, 93%, 87%, 85%) for pinpoint safe-bunk and shortage calculations.
                </p>
              </div>
            </div>

            {/* Quick Action Presets */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 mb-4 flex items-center justify-between flex-wrap gap-2 text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                Quick Presets:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[75, 80, 85, 90, 93, 95].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleApplyBulkPercentage(pct)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white/5 hover:bg-amber-500 hover:text-slate-950 text-slate-300 transition-colors border border-white/10"
                  >
                    Set all to {pct}%
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const reset: Record<string, { held: number; attended: number }> = {};
                    for (const c of state.courses) {
                      reset[c.id] = { held: 0, attended: 0 };
                    }
                    setBulkBaselines(reset);
                  }}
                  className="px-2 py-1 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-950/30 transition-colors ml-1"
                >
                  Reset All
                </button>
              </div>
            </div>

            {/* Courses Table */}
            <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1 my-2">
              <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 pb-1 border-b border-white/5">
                <div className="col-span-5 sm:col-span-4">Subject</div>
                <div className="col-span-3 sm:col-span-3 text-center">Classes Held</div>
                <div className="col-span-3 sm:col-span-3 text-center">Attended</div>
                <div className="col-span-1 sm:col-span-2 text-right">Attendance %</div>
              </div>

              {state.courses.map((c) => {
                const entry = bulkBaselines[c.id] || { held: c.baselineClassesHeld ?? 0, attended: c.baselineAttendedClasses ?? 0 };
                const curPct = entry.held > 0 ? Math.round((entry.attended / entry.held) * 1000) / 10 : 100;
                const isSafe = curPct >= collegeMin;

                return (
                  <div 
                    key={c.id} 
                    className="grid grid-cols-12 gap-2 items-center p-3 rounded-2xl bg-black/30 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="col-span-5 sm:col-span-4">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="font-mono font-bold text-xs text-white">{c.code}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5" title={c.name}>{c.name}</p>
                    </div>

                    <div className="col-span-3 sm:col-span-3 flex justify-center">
                      <input
                        type="number"
                        min="0"
                        max="250"
                        value={entry.held}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setBulkBaselines((prev) => ({
                            ...prev,
                            [c.id]: {
                              held: val,
                              attended: Math.min(val, prev[c.id]?.attended ?? 0),
                            },
                          }));
                        }}
                        className="w-20 px-2 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-xs text-center focus:outline-none focus:border-amber-400"
                        placeholder="Held"
                      />
                    </div>

                    <div className="col-span-3 sm:col-span-3 flex justify-center">
                      <input
                        type="number"
                        min="0"
                        max={entry.held || 250}
                        value={entry.attended}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setBulkBaselines((prev) => ({
                            ...prev,
                            [c.id]: {
                              held: prev[c.id]?.held ?? 0,
                              attended: Math.min(prev[c.id]?.held ?? 0, val),
                            },
                          }));
                        }}
                        className="w-20 px-2 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-xs text-center focus:outline-none focus:border-amber-400"
                        placeholder="Attended"
                      />
                    </div>

                    <div className="col-span-1 sm:col-span-2 text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-mono font-bold ${
                        isSafe ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-500/20' : 'text-rose-400 bg-rose-950/40 border border-rose-500/20'
                      }`}>
                        {entry.held > 0 ? `${curPct}%` : '100%'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-white/10">
              <span className="text-[11px] text-slate-400">
                Calibrating {state.courses.length} subjects for accurate safe-bunks and shortages.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBulkMatrix(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkMatrixSaving}
                  onClick={handleSaveBulkMatrix}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 shadow-md font-bold transition-all disabled:opacity-50"
                >
                  {bulkMatrixSaving ? 'Saving...' : 'Save All Baselines'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
