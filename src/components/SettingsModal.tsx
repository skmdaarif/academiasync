import { useState } from 'react';
import { StudentData, UserAccount, Course, MidSemCatchupData, MidSemCatchupTask, MidSemCatchupExam, TaskPriority, ExamCategory } from '../types';
import { THEMES } from '../styles/themes';
import { getLocalDateString } from '../utils/timeUtils';
import { X, User, BookOpen, Trash2, Check, RotateCcw, Edit3, Database, Award, Sparkles, Plus, ClipboardList, FileText, CheckSquare, ChevronDown, ChevronUp } from 'lucide-react';

interface SettingsModalProps {
  user: UserAccount;
  state: StudentData;
  onClose: () => void;
  onUpdateUser: (user: UserAccount) => void;
  onUpdateCourse?: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
  onClearAllData: () => void;
  onDeleteAccount: () => void;
  onSyncToSQLite?: () => void;
  onSyncToPostgres?: () => void;
  onOpenVault?: () => void;
  onApplyMidSemCatchup?: (catchup: MidSemCatchupData) => Promise<void>;
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

export function SettingsModal({
  user,
  state,
  onClose,
  onUpdateUser,
  onUpdateCourse,
  onDeleteCourse,
  onClearAllData,
  onDeleteAccount,
  onSyncToSQLite,
  onSyncToPostgres,
  onOpenVault,
  onApplyMidSemCatchup,
}: SettingsModalProps) {
  const handleSync = onSyncToSQLite || onSyncToPostgres;
  const theme = THEMES[state.theme] || THEMES['dark-slate'];

  const [formData, setFormData] = useState<UserAccount>({ ...user });
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Mid-Semester Catch-Up Drawer State
  const todayStr = getLocalDateString();
  const isPastTermStart = formData.semesterStartDate && formData.semesterStartDate < todayStr;
  const elapsedDays = isPastTermStart
    ? Math.max(0, Math.floor((new Date(todayStr).getTime() - new Date(formData.semesterStartDate!).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  const elapsedWeeks = Math.floor(elapsedDays / 7);

  const [showCatchupDrawer, setShowCatchupDrawer] = useState(false);
  const [catchupAttendancePct, setCatchupAttendancePct] = useState(user.initialAttendancePct || 80);
  const [completedTasksList, setCompletedTasksList] = useState<MidSemCatchupTask[]>([]);
  const [pendingTasksList, setPendingTasksList] = useState<MidSemCatchupTask[]>([]);
  const [conductedExamsList, setConductedExamsList] = useState<MidSemCatchupExam[]>([]);
  const [catchupSaving, setCatchupSaving] = useState(false);
  const [catchupSuccess, setCatchupSuccess] = useState(false);

  const handleApplyCatchup = async () => {
    if (!onApplyMidSemCatchup) return;
    setCatchupSaving(true);
    try {
      await onApplyMidSemCatchup({
        attendancePct: Number(catchupAttendancePct) || 80,
        completedTasks: completedTasksList.filter((t) => t.title && t.title.trim()),
        pendingTasks: pendingTasksList.filter((t) => t.title && t.title.trim()),
        conductedExams: conductedExamsList.filter((e) => e.title && e.title.trim()),
      });
      setCatchupSuccess(true);
      setTimeout(() => setCatchupSuccess(false), 2500);
    } finally {
      setCatchupSaving(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to erase all your courses, schedule slots, and tasks to start fresh? This cannot be undone.')) {
      onClearAllData();
      onClose();
    }
  };

  const handleDeleteAccount = () => {
    if (
      window.confirm(
        '⚠️ PERMANENT ACCOUNT DELETION\n\nAre you sure you want to delete your student account? All your courses, timetable slots, attendance logs, and tasks will be erased permanently. This action CANNOT be undone.'
      )
    ) {
      onDeleteAccount();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="w-full max-w-xl rounded-3xl p-6 sm:p-8 border shadow-2xl relative my-8"
        style={{
          backgroundColor: theme.headerBg,
          borderColor: theme.cardBorder,
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-md"
            style={{ backgroundColor: theme.accent }}
          >
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: theme.textPrimary }}>
              Profile & Academic Settings
            </h2>
            <p className="text-xs text-slate-400">
              Update your student profile, academic semester, and course listings.
            </p>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Student Full Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                College / University Name
              </label>
              <input
                type="text"
                value={formData.collegeName}
                onChange={(e) => setFormData({ ...formData, collegeName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Branch / Major
              </label>
              <input
                type="text"
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Semester / Year
              </label>
              <input
                type="text"
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Student Lab Batch / Section
              </label>
              <input
                type="text"
                placeholder="e.g. Batch B2 / Section 3"
                value={formData.studentBatch || ''}
                onChange={(e) => setFormData({ ...formData, studentBatch: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Semester Start Date
              </label>
              <input
                type="date"
                value={formData.semesterStartDate ? formData.semesterStartDate.split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, semesterStartDate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tentative Classes End Date
              </label>
              <input
                type="date"
                value={formData.classesEndDate ? formData.classesEndDate.split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, classesEndDate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
            </div>
          </div>

          {/* Mid-Semester Catch-Up / Calibration Section */}
          {isPastTermStart && (
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Mid-Semester Calibration ({elapsedWeeks > 0 ? `${elapsedWeeks} week${elapsedWeeks > 1 ? 's' : ''}` : `${elapsedDays} day${elapsedDays > 1 ? 's' : ''}`} elapsed)
                  </span>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Classes commenced on {formData.semesterStartDate}. Calibrate past attendance baseline, completed assignments, active work, or conducted exams.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCatchupDrawer(!showCatchupDrawer)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold whitespace-nowrap"
                >
                  {showCatchupDrawer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showCatchupDrawer ? 'Close' : 'Calibrate'}
                </button>
              </div>

              {showCatchupDrawer && (
                <div className="space-y-4 pt-2 border-t border-amber-500/20">
                  {/* 1. Overall Attendance % till now */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                      1. What is your approximate attendance percentage till now?
                    </label>
                    <div className="flex items-center gap-2">
                      {[70, 75, 80, 85, 90, 95].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setCatchupAttendancePct(pct)}
                          className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                            catchupAttendancePct === pct
                              ? 'bg-amber-500 text-slate-950 shadow-sm'
                              : 'bg-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                      <div className="w-16">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={catchupAttendancePct}
                          onChange={(e) => setCatchupAttendancePct(Number(e.target.value) || 0)}
                          className="w-full px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs text-center font-bold focus:outline-none"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Calibrates course baseline classes held & attended to reflect elapsed weeks.
                    </p>
                  </div>

                  {/* 2. Completed Assignments */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                        2. Any assignments already submitted / completed?
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setCompletedTasksList([
                            ...completedTasksList,
                            {
                              title: `Assignment ${completedTasksList.length + 1}`,
                              dueDate: formData.semesterStartDate || todayStr,
                              status: 'completed',
                            },
                          ]);
                        }}
                        className="text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-semibold"
                      >
                        <Plus className="w-3 h-3" /> Add Completed
                      </button>
                    </div>

                    {completedTasksList.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">None added in this session.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {completedTasksList.map((t, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-lg border border-white/5">
                            <input
                              type="text"
                              placeholder="e.g. Lab Report 1"
                              value={t.title}
                              onChange={(e) => {
                                const updated = [...completedTasksList];
                                updated[idx].title = e.target.value;
                                setCompletedTasksList(updated);
                              }}
                              className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                            />
                            <input
                              type="date"
                              value={t.dueDate}
                              onChange={(e) => {
                                const updated = [...completedTasksList];
                                updated[idx].dueDate = e.target.value;
                                setCompletedTasksList(updated);
                              }}
                              className="w-28 px-1.5 py-1 rounded bg-white/5 border border-white/10 text-white text-[11px] focus:outline-none"
                            />
                            {state.courses.length > 0 && (
                              <select
                                value={t.courseId || ''}
                                onChange={(e) => {
                                  const updated = [...completedTasksList];
                                  updated[idx].courseId = e.target.value || undefined;
                                  setCompletedTasksList(updated);
                                }}
                                className="w-24 px-1.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300 text-[11px] focus:outline-none"
                              >
                                <option value="" className="bg-slate-900">Course</option>
                                {state.courses.map((c) => (
                                  <option key={c.id} value={c.id} className="bg-slate-900">{c.code}</option>
                                ))}
                              </select>
                            )}
                            <button
                              type="button"
                              onClick={() => setCompletedTasksList(completedTasksList.filter((_, i) => i !== idx))}
                              className="p-1 text-slate-400 hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. Pending Assignments */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5 text-amber-400" />
                        3. Any assignments currently pending or ongoing?
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const inOneWeek = getLocalDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
                          setPendingTasksList([
                            ...pendingTasksList,
                            {
                              title: `Assignment ${pendingTasksList.length + 1}`,
                              dueDate: inOneWeek,
                              priority: 'medium',
                              status: 'todo',
                            },
                          ]);
                        }}
                        className="text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold"
                      >
                        <Plus className="w-3 h-3" /> Add Pending
                      </button>
                    </div>

                    {pendingTasksList.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">None added in this session.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {pendingTasksList.map((t, idx) => (
                          <div key={idx} className="flex flex-col gap-1.5 bg-black/30 p-2 rounded-lg border border-white/5">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                placeholder="e.g. Operating Systems Paging Problem"
                                value={t.title}
                                onChange={(e) => {
                                  const updated = [...pendingTasksList];
                                  updated[idx].title = e.target.value;
                                  setPendingTasksList(updated);
                                }}
                                className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                              />
                              <input
                                type="date"
                                value={t.dueDate}
                                onChange={(e) => {
                                  const updated = [...pendingTasksList];
                                  updated[idx].dueDate = e.target.value;
                                  setPendingTasksList(updated);
                                }}
                                className="w-28 px-1.5 py-1 rounded bg-white/5 border border-white/10 text-white text-[11px] focus:outline-none"
                              />
                              <select
                                value={t.priority || 'medium'}
                                onChange={(e) => {
                                  const updated = [...pendingTasksList];
                                  updated[idx].priority = e.target.value as TaskPriority;
                                  setPendingTasksList(updated);
                                }}
                                className="w-20 px-1 py-1 rounded bg-white/5 border border-white/10 text-slate-300 text-[11px] focus:outline-none"
                              >
                                <option value="low" className="bg-slate-900">Low</option>
                                <option value="medium" className="bg-slate-900">Medium</option>
                                <option value="high" className="bg-slate-900">High</option>
                                <option value="urgent" className="bg-slate-900">Urgent</option>
                              </select>
                              {state.courses.length > 0 && (
                                <select
                                  value={t.courseId || ''}
                                  onChange={(e) => {
                                    const updated = [...pendingTasksList];
                                    updated[idx].courseId = e.target.value || undefined;
                                    setPendingTasksList(updated);
                                  }}
                                  className="w-24 px-1.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300 text-[11px] focus:outline-none"
                                >
                                  <option value="" className="bg-slate-900">Course</option>
                                  {state.courses.map((c) => (
                                    <option key={c.id} value={c.id} className="bg-slate-900">{c.code}</option>
                                  ))}
                                </select>
                              )}
                              <button
                                type="button"
                                onClick={() => setPendingTasksList(pendingTasksList.filter((_, i) => i !== idx))}
                                className="p-1 text-slate-400 hover:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <input
                              type="url"
                              placeholder="Optional LMS submission link (Classroom / Moodle / Drive)"
                              value={t.submissionUrl || ''}
                              onChange={(e) => {
                                const updated = [...pendingTasksList];
                                updated[idx].submissionUrl = e.target.value;
                                setPendingTasksList(updated);
                              }}
                              className="w-full px-2 py-1 rounded bg-white/5 border border-white/10 text-slate-300 text-[11px] focus:outline-none placeholder:text-slate-500"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 4. Conducted Exams */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                      <label className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-cyan-400" />
                        4. Which exams have already been conducted?
                        {conductedExamsList.length > 0 && (
                          <span className="text-[10px] text-amber-300/80 font-normal">
                            ({conductedExamsList.filter(e => !e.isResultAwaiting && e.marksObtained != null).length} declared, {conductedExamsList.filter(e => e.isResultAwaiting || e.marksObtained == null).length} awaiting)
                          </span>
                        )}
                      </label>
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setConductedExamsList([
                              ...conductedExamsList,
                              {
                                title: `CA ${conductedExamsList.filter(e => e.examCategory === 'ca').length + 1}`,
                                examCategory: 'ca',
                                examDate: formData.semesterStartDate || todayStr,
                                maxMarks: 20,
                                marksObtained: 18,
                                isResultAwaiting: false,
                              },
                            ]);
                          }}
                          className="text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-semibold"
                        >
                          <Plus className="w-3 h-3" /> + Declared CA
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConductedExamsList([
                              ...conductedExamsList,
                              {
                                title: `CA ${conductedExamsList.filter(e => e.examCategory === 'ca').length + 1}`,
                                examCategory: 'ca',
                                examDate: formData.semesterStartDate || todayStr,
                                maxMarks: 20,
                                isResultAwaiting: true,
                              },
                            ]);
                          }}
                          className="text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold"
                        >
                          <Plus className="w-3 h-3" /> + ⏳ Awaiting CA
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConductedExamsList([
                              ...conductedExamsList,
                              {
                                title: `MTT ${conductedExamsList.filter(e => e.examCategory === 'mtt').length + 1}`,
                                examCategory: 'mtt',
                                examDate: formData.semesterStartDate || todayStr,
                                maxMarks: 30,
                                marksObtained: 24,
                                isResultAwaiting: false,
                              },
                            ]);
                          }}
                          className="text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-semibold"
                        >
                          <Plus className="w-3 h-3" /> + MTT
                        </button>
                      </div>
                    </div>

                    {conductedExamsList.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">None added in this session.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {conductedExamsList.map((e, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 bg-black/30 p-2 rounded-lg border border-white/5">
                            <input
                              type="text"
                              placeholder="e.g. CA 1"
                              value={e.title}
                              onChange={(ev) => {
                                const updated = [...conductedExamsList];
                                updated[idx].title = ev.target.value;
                                setConductedExamsList(updated);
                              }}
                              className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                            />
                            <select
                              value={e.examCategory}
                              onChange={(ev) => {
                                const updated = [...conductedExamsList];
                                updated[idx].examCategory = ev.target.value as ExamCategory;
                                setConductedExamsList(updated);
                              }}
                              className="w-20 px-1 py-1 rounded bg-white/5 border border-white/10 text-slate-300 text-[11px] focus:outline-none"
                            >
                              <option value="mtt" className="bg-slate-900">MTT</option>
                              <option value="ca" className="bg-slate-900">CA</option>
                              <option value="quiz" className="bg-slate-900">Quiz</option>
                              <option value="viva" className="bg-slate-900">Viva</option>
                              <option value="ett" className="bg-slate-900">ETT</option>
                              <option value="project" className="bg-slate-900">Project</option>
                            </select>
                            {state.courses.length > 0 && (
                              <select
                                value={e.courseId || ''}
                                onChange={(ev) => {
                                  const updated = [...conductedExamsList];
                                  updated[idx].courseId = ev.target.value || undefined;
                                  setConductedExamsList(updated);
                                }}
                                className="w-24 px-1.5 py-1 rounded bg-white/5 border border-white/10 text-slate-300 text-[11px] focus:outline-none"
                              >
                                <option value="" className="bg-slate-900">Course</option>
                                {state.courses.map((c) => (
                                  <option key={c.id} value={c.id} className="bg-slate-900">{c.code}</option>
                                ))}
                              </select>
                            )}
                            <input
                              type="date"
                              value={e.examDate}
                              onChange={(ev) => {
                                const updated = [...conductedExamsList];
                                updated[idx].examDate = ev.target.value;
                                setConductedExamsList(updated);
                              }}
                              className="w-28 px-1.5 py-1 rounded bg-white/5 border border-white/10 text-white text-[11px] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...conductedExamsList];
                                const nextState = !updated[idx].isResultAwaiting;
                                updated[idx].isResultAwaiting = nextState;
                                if (nextState) {
                                  updated[idx].marksObtained = undefined;
                                } else if (updated[idx].marksObtained === undefined) {
                                  updated[idx].marksObtained = Math.round((updated[idx].maxMarks || 20) * 0.85);
                                }
                                setConductedExamsList(updated);
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                                e.isResultAwaiting
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              }`}
                              title="Toggle whether marks have been declared by faculty"
                            >
                              {e.isResultAwaiting ? '⏳ Awaiting' : '✅ Declared'}
                            </button>
                            <div className="flex items-center gap-1">
                              {!e.isResultAwaiting ? (
                                <>
                                  <input
                                    type="number"
                                    placeholder="Marks"
                                    value={e.marksObtained ?? ''}
                                    onChange={(ev) => {
                                      const updated = [...conductedExamsList];
                                      updated[idx].marksObtained = ev.target.value ? Number(ev.target.value) : undefined;
                                      setConductedExamsList(updated);
                                    }}
                                    className="w-14 px-1.5 py-1 rounded bg-white/5 border border-white/10 text-white text-[11px] text-center font-bold focus:outline-none placeholder:font-normal placeholder:text-slate-500"
                                  />
                                  <span className="text-slate-400 text-xs">/</span>
                                </>
                              ) : (
                                <span className="text-[10px] text-amber-400 font-mono px-1">Max:</span>
                              )}
                              <input
                                type="number"
                                placeholder="Max"
                                value={e.maxMarks ?? ''}
                                onChange={(ev) => {
                                  const updated = [...conductedExamsList];
                                  updated[idx].maxMarks = ev.target.value ? Number(ev.target.value) : undefined;
                                  setConductedExamsList(updated);
                                }}
                                className="w-14 px-1.5 py-1 rounded bg-white/5 border border-white/10 text-white text-[11px] text-center font-bold focus:outline-none placeholder:font-normal placeholder:text-slate-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setConductedExamsList(conductedExamsList.filter((_, i) => i !== idx))}
                              className="p-1 text-slate-400 hover:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Apply Catch-Up Button */}
                  <div className="pt-2 flex items-center justify-between">
                    {catchupSuccess && (
                      <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Calibration applied successfully!
                      </span>
                    )}
                    {!catchupSuccess && <div />}
                    <button
                      type="button"
                      disabled={catchupSaving}
                      onClick={handleApplyCatchup}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50"
                    >
                      {catchupSaving ? 'Applying...' : 'Apply Calibration to Courses'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                College Min Requirement (%)
              </label>
              <input
                type="number"
                min="50"
                max="100"
                value={formData.collegeMinAttendance || 75}
                onChange={(e) => {
                  const collegeVal = parseInt(e.target.value, 10) || 75;
                  setFormData({
                    ...formData,
                    collegeMinAttendance: collegeVal,
                    // Auto-adjust personal goal if it would fall below college minimum
                    personalGoalAttendance: Math.max(collegeVal, formData.personalGoalAttendance || collegeVal),
                  });
                }}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Personal Attendance Goal (%)
              </label>
              <input
                type="number"
                min={formData.collegeMinAttendance || 75}
                max="100"
                value={formData.personalGoalAttendance || formData.collegeMinAttendance || 75}
                onChange={(e) => {
                  const goalVal = parseInt(e.target.value, 10) || (formData.collegeMinAttendance || 75);
                  setFormData({
                    ...formData,
                    personalGoalAttendance: goalVal,
                    targetAttendance: goalVal,
                  });
                }}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
              <span className="text-[10px] text-amber-400/80 mt-0.5 block">
                Must be ≥ {formData.collegeMinAttendance || 75}% (Defaults to College Min)
              </span>
            </div>
          </div>

          {/* Excused / OD Attendance Credit Policy */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              On-Duty (OD) & Medical Leave Policy
            </label>
            <select
              value={formData.excusedPolicy || 'exemption'}
              onChange={(e) => setFormData({ ...formData, excusedPolicy: e.target.value as 'exemption' | 'credit' })}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
            >
              <option value="exemption" className="bg-slate-900">
                Exemption Mode (Default) — Excused classes excluded from held total (0 penalty)
              </option>
              <option value="credit" className="bg-slate-900">
                Full Credit Mode — Excused classes with approved certificate credited as attended (+1 held, +1 attended)
              </option>
            </select>
            <p className="text-[10px] text-slate-400 mt-1">
              Configure according to your university regulations (e.g. SRM / Amity / Manipal vs VTU / Anna Univ).
            </p>
          </div>

          {/* Courses List */}
          <div className="pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Registered Courses ({state.courses.length})
            </h4>

            {state.courses.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {state.courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: course.color }}
                      />
                      <span className="font-mono font-bold text-white">{course.code}</span>
                      <span className="text-slate-300 truncate max-w-[180px]">{course.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingCourse({ ...course })}
                        className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
                        title="Edit Course Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete course ${course.code} and its scheduled slots?`)) {
                            onDeleteCourse(course.id);
                          }
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/30 transition-colors"
                        title="Delete Course"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-2">
                No courses added yet.
              </p>
            )}
          </div>

          {/* Footer controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 flex-wrap">
              {onOpenVault && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenVault();
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-indigo-950/30 transition-colors"
                  title="View lifetime degree performance, past semesters, and credits"
                >
                  <Award className="w-3.5 h-3.5" />
                  Academic Vault
                </button>
              )}
              {handleSync && (
                <button
                  type="button"
                  onClick={handleSync}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-emerald-950/30 transition-colors"
                  title="Push and synchronize all current timetable and attendance data into the local SQLite database"
                >
                  <Database className="w-3.5 h-3.5" />
                  Sync to SQLite DB
                </button>
              )}
              <button
                type="button"
                onClick={handleClearData}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-amber-950/30 transition-colors"
                title="Wipe schedule and start blank while keeping account"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Data
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-rose-950/30 transition-colors"
                title="Permanently remove your account and all data"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Account
              </button>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-1.5"
                style={{ backgroundColor: theme.accent }}
              >
                {savedSuccess ? <Check className="w-4 h-4" /> : null}
                {savedSuccess ? 'Saved!' : 'Save Settings'}
              </button>
            </div>
          </div>
        </form>

      </div>

      {/* Course Edit Submodal */}
      {editingCourse && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div 
            className="w-full max-w-md rounded-3xl p-6 border shadow-2xl relative"
            style={{
              backgroundColor: theme.headerBg,
              borderColor: theme.cardBorder,
            }}
          >
            <button
              onClick={() => setEditingCourse(null)}
              className="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-white bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: theme.textPrimary }}>
              <Edit3 className="w-4 h-4 text-indigo-400" />
              Edit Course Details: {editingCourse.code}
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onUpdateCourse && editingCourse) {
                  onUpdateCourse(editingCourse);
                }
                setEditingCourse(null);
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Code</label>
                  <input
                    type="text"
                    value={editingCourse.code}
                    onChange={(e) => setEditingCourse({ ...editingCourse, code: e.target.value.toUpperCase() })}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono uppercase focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Subject Name</label>
                  <input
                    type="text"
                    value={editingCourse.name}
                    onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Professor</label>
                  <input
                    type="text"
                    value={editingCourse.professor || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, professor: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Default Room</label>
                  <input
                    type="text"
                    value={editingCourse.defaultRoom || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, defaultRoom: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Badge Color</label>
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Credits</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editingCourse.credits || 3}
                    onChange={(e) => setEditingCourse({ ...editingCourse, credits: parseInt(e.target.value, 10) || 3 })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Attendance %</label>
                  <input
                    type="number"
                    min={formData.collegeMinAttendance || 75}
                    max="100"
                    value={editingCourse.attendanceGoal || formData.collegeMinAttendance || 75}
                    onChange={(e) => setEditingCourse({ ...editingCourse, attendanceGoal: parseInt(e.target.value, 10) || (formData.collegeMinAttendance || 75) })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
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
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
