import { useState } from 'react';
import { Course, StudentData, AttendanceStatus, UserAccount } from '../types';
import { THEMES } from '../styles/themes';
import { calculateAttendance } from '../utils/timeUtils';
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
  Calendar
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface AttendanceCalculatorProps {
  user: UserAccount;
  state: StudentData;
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
  const totalClasses = state.courses.reduce((acc, c) => acc + (c.totalClasses || 0), 0);
  const totalAttended = state.courses.reduce((acc, c) => acc + (c.attendedClasses || 0), 0);
  const overallPercentage = totalClasses > 0 ? Math.round((totalAttended / totalClasses) * 1000) / 10 : 100;
  
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

      {/* Header and History Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h3 className="text-lg font-bold" style={{ color: theme.textPrimary }}>
            Course-by-Course Attendance Breakdown
          </h3>
          <p className="text-xs text-slate-400">
            Real-time safe bunk thresholds & attendance logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-200 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-1.5 shadow-sm"
              title="Open full attendance records history"
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              Attendance History & Logs ({state.attendanceRecords?.length || 0})
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
          const analysis = calculateAttendance(course, collegeMin, personalGoal);

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
                  <div className="flex justify-between text-[11px] font-semibold text-slate-400 mb-1">
                    <span>
                      {(course.attendedClasses || 0) + (course.baselineAttendedClasses || 0)} / {(course.totalClasses || 0) + (course.baselineClassesHeld || 0)} attended
                      {Boolean((course.baselineClassesHeld || 0) > 0) && (
                        <span className="text-[10px] text-indigo-400 font-normal ml-1">
                          (incl. {course.baselineClassesHeld} baseline)
                        </span>
                      )}
                    </span>
                    <span className="text-amber-400">Target: {course.attendanceGoal || personalGoal}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-white/10 relative overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        analysis.isPersonalGoalMet ? 'bg-emerald-500' : analysis.isCollegeSafe ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, analysis.percentage)}%` }}
                    />
                  </div>
                </div>

                {/* Bunk status badge */}
                <div className="mt-3">
                  <div className={`p-2 rounded-xl text-xs font-semibold border text-center ${analysis.badgeColor}`}>
                    {analysis.statusText}
                  </div>
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
                    ⚪ Cancelled
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

    </div>
  );
}
