import React, { useState, useEffect } from 'react';
import { StudentData, Exam, ExamCategory, ExamType, SyllabusUnit, Task } from '../types';
import { THEMES } from '../styles/themes';
import { 
  Flame, 
  Plus, 
  CheckCircle2, 
  Circle, 
  GraduationCap, 
  Calendar, 
  Clock, 
  MapPin, 
  BookOpen, 
  Beaker, 
  Award, 
  Edit3, 
  Trash2, 
  X, 
  ChevronRight, 
  TrendingUp, 
  Filter, 
  AlertCircle,
  FileCheck,
  Check,
  Sparkles
} from 'lucide-react';
import { formatTime12h } from '../utils/timeUtils';
import confetti from 'canvas-confetti';

interface ExamCountdownHubProps {
  state: StudentData;
  onOpenAddModal?: () => void;
  onUpdateTask?: (task: Task) => void;
  onAddExam?: (exam: Omit<Exam, 'id' | 'createdAt'>) => void;
  onUpdateExam?: (exam: Exam) => void;
  onDeleteExam?: (examId: string) => void;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
  isToday: boolean;
}

function calculateTimeLeft(targetDate: string, targetTime: string = '09:00'): TimeRemaining {
  const [y, m, d] = targetDate.split('-').map(Number);
  const [hh, mm] = targetTime.split(':').map(Number);
  const target = new Date(y, m - 1, d, hh || 9, mm || 0, 0).getTime();
  const now = new Date().getTime();
  const diff = target - now;

  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = targetDate === todayStr;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true, isToday };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, isPast: false, isToday };
}

const CATEGORY_LABELS: Record<ExamCategory, { label: string; desc: string }> = {
  mtt: { label: 'MTT (Mid-Term)', desc: 'Mid-Term Examinations / Sessional Tests' },
  ett: { label: 'ETT (End-Term)', desc: 'End-Term Finals & University Examinations' },
  ca: { label: 'CA / Class Test', desc: 'Continuous Assessments & Mini Tests' },
  viva: { label: 'Lab Viva / Oral', desc: 'Practical Vivas & Lab Evaluations' },
  quiz: { label: 'Quiz / Test', desc: 'Surprise Tests & Weekly MCQs' },
  project: { label: 'Project / Jury', desc: 'Capstone Milestones & Design Jury' },
  backlog: { label: 'Backlog / Re-sit', desc: 'Supplementary & Improvement Exams' },
  other: { label: 'Other Exam', desc: 'Quiz, Entrance, or Certification' },
};

export function ExamCountdownHub({
  state,
  onOpenAddModal,
  onUpdateTask,
  onAddExam,
  onUpdateExam,
  onDeleteExam,
}: ExamCountdownHubProps) {
  const [, setTick] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | ExamCategory>('all');
  const [activeTypeFilter, setActiveTypeFilter] = useState<'all' | ExamType>('all');
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State for Add / Edit Modal
  const [formTitle, setFormTitle] = useState('');
  const [formCourseId, setFormCourseId] = useState('');
  const [formCategory, setFormCategory] = useState<ExamCategory>('mtt');
  const [formType, setFormType] = useState<ExamType>('theory');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('12:00');
  const [formRoomOrLab, setFormRoomOrLab] = useState('');
  const [formSeatNumber, setFormSeatNumber] = useState('');
  const [formSession, setFormSession] = useState<'morning' | 'afternoon'>('morning');
  const [formMaxMarks, setFormMaxMarks] = useState<string>('50');
  const [formMarksObtained, setFormMarksObtained] = useState<string>('');
  const [formIsResultAwaiting, setFormIsResultAwaiting] = useState<boolean>(false);
  const [formNotes, setFormNotes] = useState('');
  const [formUnits, setFormUnits] = useState<{ id: string; title: string; completed: boolean }[]>([]);
  const [newUnitInput, setNewUnitInput] = useState('');

  // Target Grade Calculator State
  const [calculatorCourseId, setCalculatorCourseId] = useState<string>('');
  const [targetDesiredGrade, setTargetDesiredGrade] = useState<number>(80); // 80% for A grade
  const [evaluationScheme, setEvaluationScheme] = useState<'50-50' | '40-60' | '30-70'>('50-50');

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const theme = THEMES[state.theme] || THEMES['dark-slate'];
  const courseMap = new Map(state.courses.map((c) => [c.id, c]));

  // Native exams from state.exams
  const nativeExams = state.exams || [];

  // Filter exams based on selected tabs
  const filteredExams = nativeExams.filter((ex) => {
    if (activeTab !== 'all' && ex.examCategory !== activeTab) return false;
    if (activeTypeFilter !== 'all' && ex.examType !== activeTypeFilter) return false;
    return true;
  }).sort((a, b) => new Date(a.examDate).getTime() - new Date(b.examDate).getTime());

  // Also include backward-compatible task exams if any exist and user selected 'all'
  const legacyTaskExams = (state.tasks || [])
    .filter((t) => t.category === 'exam' || t.category === 'quiz')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const openCreateModal = () => {
    setEditingExam(null);
    setFormTitle('');
    setFormCourseId(state.courses[0]?.id || '');
    setFormCategory('mtt');
    setFormType('theory');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormStartTime('09:00');
    setFormEndTime('12:00');
    setFormRoomOrLab('');
    setFormSeatNumber('');
    setFormSession('morning');
    setFormMaxMarks('50');
    setFormMarksObtained('');
    setFormIsResultAwaiting(false);
    setFormNotes('');
    setFormUnits([
      { id: '1', title: 'Unit 1: Fundamentals', completed: false },
      { id: '2', title: 'Unit 2: Core Concepts', completed: false },
    ]);
    setIsAddModalOpen(true);
  };

  const openEditModal = (exam: Exam) => {
    setEditingExam(exam);
    setFormTitle(exam.title);
    setFormCourseId(exam.courseId || '');
    setFormCategory(exam.examCategory);
    setFormType(exam.examType);
    setFormDate(exam.examDate);
    setFormStartTime(exam.startTime || '09:00');
    setFormEndTime(exam.endTime || '12:00');
    setFormRoomOrLab(exam.roomOrLab || '');
    setFormSeatNumber(exam.seatNumber || '');
    setFormSession(exam.session || 'morning');
    setFormMaxMarks(exam.maxMarks !== undefined && exam.maxMarks !== null ? String(exam.maxMarks) : '');
    setFormMarksObtained(exam.marksObtained !== undefined && exam.marksObtained !== null ? String(exam.marksObtained) : '');
    setFormIsResultAwaiting(Boolean(exam.isResultAwaiting));
    setFormNotes(exam.notes || '');
    setFormUnits(exam.syllabusUnits ? [...exam.syllabusUnits] : []);
    setIsAddModalOpen(true);
  };

  const handleSaveExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const parsedMax = formMaxMarks ? parseFloat(formMaxMarks) : undefined;
    const parsedObtained = !formIsResultAwaiting && formMarksObtained ? parseFloat(formMarksObtained) : undefined;

    if (editingExam && onUpdateExam) {
      onUpdateExam({
        ...editingExam,
        title: formTitle.trim(),
        courseId: formCourseId || undefined,
        examCategory: formCategory,
        examType: formType,
        examDate: formDate,
        startTime: formStartTime,
        endTime: formEndTime,
        roomOrLab: formRoomOrLab.trim() || undefined,
        seatNumber: formSeatNumber.trim() || undefined,
        session: formSession,
        maxMarks: parsedMax,
        marksObtained: parsedObtained,
        isResultAwaiting: formIsResultAwaiting,
        syllabusUnits: formUnits,
        notes: formNotes.trim() || undefined,
      });
    } else if (onAddExam) {
      onAddExam({
        title: formTitle.trim(),
        courseId: formCourseId || undefined,
        examCategory: formCategory,
        examType: formType,
        examDate: formDate,
        startTime: formStartTime,
        endTime: formEndTime,
        roomOrLab: formRoomOrLab.trim() || undefined,
        seatNumber: formSeatNumber.trim() || undefined,
        session: formSession,
        maxMarks: parsedMax,
        marksObtained: parsedObtained,
        isResultAwaiting: formIsResultAwaiting,
        syllabusUnits: formUnits,
        notes: formNotes.trim() || undefined,
        semesterNumber: state.activeSemesterNumber || 1,
      });
    }

    setIsAddModalOpen(false);
  };

  const handleToggleUnit = (exam: Exam, unitId: string) => {
    if (!onUpdateExam) return;
    const currentUnits = exam.syllabusUnits || [];
    const updatedUnits = currentUnits.map((u) =>
      u.id === unitId ? { ...u, completed: !u.completed } : u
    );

    const allCompletedNow = updatedUnits.every((u) => u.completed);
    if (allCompletedNow && updatedUnits.length > 0) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
      });
    }

    onUpdateExam({
      ...exam,
      syllabusUnits: updatedUnits,
    });
  };

  const handleAddUnitToExam = (exam: Exam, title: string) => {
    if (!title.trim() || !onUpdateExam) return;
    const currentUnits = exam.syllabusUnits || [];
    const newUnit: SyllabusUnit = {
      id: `u_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      completed: false,
    };
    onUpdateExam({
      ...exam,
      syllabusUnits: [...currentUnits, newUnit],
    });
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div 
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-7 rounded-3xl border shadow-xl relative overflow-hidden"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
        }}
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              University Assessment Suite
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Sem {state.activeSemesterNumber || 1}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: theme.textPrimary }}>
            Exam & Assessment Hub
          </h2>
          <p className="text-xs sm:text-sm font-medium mt-1 max-w-xl text-slate-400">
            Precision countdowns, theory vs. practical schedules, syllabus unit revision checklists, and target grade prediction across MTT, ETT, and Continuous Assessments.
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 flex-wrap">
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
            style={{
              backgroundColor: theme.accent,
              boxShadow: `0 0 16px ${theme.accentGlow}`,
            }}
          >
            <Plus className="w-4 h-4" />
            Schedule Examination
          </button>
        </div>
      </div>

      {/* Filter Tabs: Exam Categories & Types */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {(['all', 'mtt', 'ett', 'ca', 'viva', 'quiz', 'project', 'backlog', 'other'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === cat
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {cat === 'all' ? 'All Assessments' : CATEGORY_LABELS[cat].label}
            </button>
          ))}
        </div>

        {/* Theory vs Practical Filter */}
        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/5 self-start sm:self-auto">
          {(['all', 'theory', 'practical', 'hybrid'] as const).map((typ) => (
            <button
              key={typ}
              onClick={() => setActiveTypeFilter(typ)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize transition-all ${
                activeTypeFilter === typ
                  ? 'bg-white/15 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {typ}
            </button>
          ))}
        </div>
      </div>

      {/* Countdown Cards Grid */}
      {filteredExams.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredExams.map((exam) => {
            const course = exam.courseId ? courseMap.get(exam.courseId) : undefined;
            const timeLeft = calculateTimeLeft(exam.examDate, exam.startTime || '09:00');
            const units = exam.syllabusUnits || [];
            const completedUnits = units.filter((u) => u.completed).length;
            const unitProgressPct = units.length > 0 ? Math.round((completedUnits / units.length) * 100) : 0;

            const categoryInfo = CATEGORY_LABELS[exam.examCategory] || CATEGORY_LABELS['other'];
            const isPractical = exam.examType === 'practical';

            return (
              <div
                key={exam.id}
                className="rounded-3xl p-6 border shadow-xl relative overflow-hidden flex flex-col justify-between transition-all hover:translate-y-[-2px]"
                style={{
                  backgroundColor: theme.cardBg,
                  borderColor: timeLeft.isToday ? '#ef4444' : theme.cardBorder,
                  boxShadow: timeLeft.isToday ? '0 10px 30px -10px rgba(239, 68, 68, 0.3)' : undefined,
                }}
              >
                {/* Top Accent Strip */}
                <div 
                  className="absolute left-0 top-0 bottom-0 w-2"
                  style={{ backgroundColor: course?.color || (isPractical ? '#a855f7' : '#3b82f6') }}
                />

                <div className="pl-2">
                  {/* Top Badges Header */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {categoryInfo.label}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold uppercase flex items-center gap-1 border ${
                        isPractical
                          ? 'bg-purple-950/40 text-purple-300 border-purple-500/30'
                          : 'bg-sky-950/40 text-sky-300 border-sky-500/30'
                      }`}>
                        {isPractical ? <Beaker className="w-3 h-3" /> : <BookOpen className="w-3 h-3" />}
                        {exam.examType}
                      </span>
                      {course && (
                        <span 
                          className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold text-white shadow-sm"
                          style={{ backgroundColor: course.color }}
                        >
                          {course.code}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(exam)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                        title="Edit exam details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {onDeleteExam && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete exam "${exam.title}"?`)) {
                              onDeleteExam(exam.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 bg-white/5 hover:bg-rose-950/40 transition-colors"
                          title="Delete exam"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Exam Title & Course Name */}
                  <h3 className="text-xl font-black tracking-tight" style={{ color: theme.textPrimary }}>
                    {exam.title}
                  </h3>
                  {course && (
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      {course.name} {course.professor ? `• ${course.professor}` : ''}
                    </p>
                  )}

                  {/* Schedule Details Strip */}
                  <div className="flex flex-wrap items-center gap-2 mt-3 text-xs font-semibold text-slate-300">
                    <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-xl border border-white/5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      {exam.examDate}
                    </span>
                    {exam.startTime && (
                      <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-xl border border-white/5 font-mono">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        {formatTime12h(exam.startTime)} {exam.endTime ? `- ${formatTime12h(exam.endTime)}` : ''}
                      </span>
                    )}
                    {exam.session && (
                      <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-xl border border-white/5 capitalize text-slate-300">
                        {exam.session === 'morning' ? '☀️ Morning' : '🌅 Afternoon'}
                      </span>
                    )}
                    {exam.roomOrLab && (
                      <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-xl border border-white/5">
                        <MapPin className="w-3.5 h-3.5 text-rose-400" />
                        {exam.roomOrLab}
                      </span>
                    )}
                    {exam.seatNumber && (
                      <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-xl border border-white/5 font-mono text-amber-300">
                        🪑 Desk: {exam.seatNumber}
                      </span>
                    )}
                  </div>

                  {/* Live Precision Countdown Box */}
                  <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/5">
                    {timeLeft.isPast || exam.isResultAwaiting ? (
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 font-bold text-xs">
                          {exam.isResultAwaiting ? (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              <Clock className="w-3.5 h-3.5 text-amber-400" />
                              Conducted • Results Awaiting
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-emerald-400">
                              <CheckCircle2 className="w-4 h-4" />
                              Exam Concluded
                            </span>
                          )}
                        </div>
                        {exam.isResultAwaiting ? (
                          <button
                            type="button"
                            onClick={() => openEditModal(exam)}
                            className="px-2.5 py-1 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-xs font-bold border border-indigo-500/30 transition-all flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Enter Declared Marks
                          </button>
                        ) : exam.marksObtained !== undefined && exam.marksObtained !== null && exam.maxMarks ? (
                          <div className="text-xs font-mono font-bold text-amber-400">
                            Score: {exam.marksObtained} / {exam.maxMarks} ({Math.round((exam.marksObtained / exam.maxMarks) * 100)}%)
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-amber-400" />
                            {timeLeft.isToday ? 'Commencing Today' : 'Time Remaining'}
                          </span>
                          {timeLeft.isToday && (
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500 text-white animate-pulse">
                              Active Today
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="p-2 rounded-xl bg-black/30 border border-white/5">
                            <span className="block text-xl font-black font-mono text-white">
                              {timeLeft.days}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                              Days
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-black/30 border border-white/5">
                            <span className="block text-xl font-black font-mono text-amber-400">
                              {timeLeft.hours}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                              Hours
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-black/30 border border-white/5">
                            <span className="block text-xl font-black font-mono text-sky-400">
                              {timeLeft.minutes}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                              Mins
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-black/30 border border-white/5">
                            <span className="block text-xl font-black font-mono text-rose-400">
                              {timeLeft.seconds}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">
                              Secs
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Syllabus Revision Tracker */}
                  <div className="mt-4 pt-3 border-t border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-indigo-400" />
                        Syllabus Units ({completedUnits}/{units.length})
                      </span>
                      <span className="text-xs font-mono font-bold text-indigo-400">
                        {unitProgressPct}% Revised
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-white/10 mb-3 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                        style={{ width: `${unitProgressPct}%` }}
                      />
                    </div>

                    {units.length > 0 ? (
                      <div className="space-y-1.5">
                        {units.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleToggleUnit(exam, u.id)}
                            className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors border ${
                              u.completed
                                ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-300'
                                : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            <span className={`truncate pr-2 ${u.completed ? 'line-through opacity-70' : ''}`}>
                              {u.title}
                            </span>
                            {u.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">
                        No syllabus units added yet. Click edit to add topics.
                      </p>
                    )}
                  </div>

                  {/* Evaluation / Marks Preview */}
                  {exam.maxMarks && (
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Evaluation:</span>
                      {exam.marksObtained !== undefined && exam.marksObtained !== null ? (
                        <span className="font-mono font-bold text-emerald-400">
                          {exam.marksObtained} / {exam.maxMarks} marks
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">
                          Max: {exam.maxMarks} Marks (Pending Evaluation)
                        </span>
                      )}
                    </div>
                  )}

                  {exam.notes && (
                    <p className="text-[11px] text-slate-400 mt-2 bg-black/20 p-2 rounded-lg border border-white/5 italic">
                      "{exam.notes}"
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Empty State */
        <div 
          className="p-12 text-center rounded-3xl border shadow-lg"
          style={{
            backgroundColor: theme.cardBg,
            borderColor: theme.cardBorder,
          }}
        >
          <GraduationCap className="w-12 h-12 text-indigo-400 mx-auto mb-3 opacity-80" />
          <h3 className="text-lg font-bold" style={{ color: theme.textPrimary }}>
            No Assessments Scheduled in this Category
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-5">
            Add your upcoming Mid-Terms (MTT), End-Terms (ETT), Continuous Assessments, or Lab Vivas to track countdowns, syllabus checklists, and grade goals.
          </p>
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-transform hover:scale-105"
            style={{ backgroundColor: theme.accent }}
          >
            <Plus className="w-4 h-4 inline mr-1" />
            Schedule an Exam
          </button>
        </div>
      )}

      {/* TARGET GRADE PREDICTOR & INTERNAL MARKS SIMULATOR */}
      <div 
        className="p-6 rounded-3xl border shadow-xl space-y-4"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">
              Target Grade & ETT Finals Score Predictor
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Scheme (CIE : SEE):</span>
            {(['50-50', '40-60', '30-70'] as const).map((scheme) => (
              <button
                key={scheme}
                type="button"
                onClick={() => setEvaluationScheme(scheme)}
                className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold transition-all ${
                  evaluationScheme === scheme
                    ? 'bg-indigo-500 text-white shadow'
                    : 'bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {scheme}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Select Course
            </label>
            <select
              value={calculatorCourseId}
              onChange={(e) => setCalculatorCourseId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
            >
              <option value="" className="bg-slate-900">Choose a course...</option>
              {state.courses.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900">
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Desired Grade Threshold (%)
            </label>
            <div className="flex items-center gap-2">
              {[70, 80, 90].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setTargetDesiredGrade(g)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                    targetDesiredGrade === g
                      ? 'bg-amber-500 text-slate-950 font-black shadow'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {g === 90 ? 'O (90%)' : g === 80 ? 'A+ (80%)' : 'B+ (70%)'}
                </button>
              ))}
            </div>
          </div>

          {/* Computed Prediction Result */}
          <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col justify-center">
            {(() => {
              if (!calculatorCourseId) {
                return (
                  <p className="text-xs text-slate-400 text-center">
                    Select a course to calculate target requirements.
                  </p>
                );
              }

              const courseExams = nativeExams.filter((e) => e.courseId === calculatorCourseId);
              // Internal evaluations are MTT, CA, Viva, Quiz, Project
              const declaredExams = courseExams.filter(
                (e) => !e.isResultAwaiting && e.marksObtained !== undefined && e.marksObtained !== null && e.maxMarks && e.examCategory !== 'ett'
              );
              const awaitingExams = courseExams.filter(
                (e) => (e.isResultAwaiting || e.marksObtained === undefined || e.marksObtained === null) && e.maxMarks && e.examCategory !== 'ett'
              );

              const totalMax = declaredExams.reduce((acc, e) => acc + (e.maxMarks || 0), 0);
              const totalObtained = declaredExams.reduce((acc, e) => acc + (e.marksObtained || 0), 0);
              const awaitingMax = awaitingExams.reduce((acc, e) => acc + (e.maxMarks || 0), 0);

              if (totalMax === 0 && awaitingMax === 0) {
                return (
                  <p className="text-xs text-slate-300 text-center">
                    No scored internal assessments yet. Aim for {targetDesiredGrade}% on all upcoming tests!
                  </p>
                );
              }

              // Scheme weights
              const [cieWeight, seeWeight] = evaluationScheme.split('-').map(Number);
              const ciePct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
              const internalContributed = (ciePct * cieWeight) / 100;
              const marksNeededInSeeScale = Math.max(0, targetDesiredGrade - internalContributed);
              const seePctRequired = Math.min(100, (marksNeededInSeeScale / seeWeight) * 100);

              const neededIn50 = Math.ceil((seePctRequired / 100) * 50);
              const neededIn100 = Math.ceil(seePctRequired);

              return (
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-xs font-bold text-white mb-0.5">
                    <span>CIE Declared: {totalObtained}/{totalMax} ({totalMax > 0 ? Math.round(ciePct) : 0}%)</span>
                    <span className="text-amber-400">Target: {targetDesiredGrade}%</span>
                  </div>
                  {awaitingExams.length > 0 && (
                    <div className="text-[10px] text-amber-300 font-semibold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      {awaitingExams.length} internal {awaitingExams.length === 1 ? 'assessment' : 'assessments'} awaiting results ({awaitingMax} pts pending)
                    </div>
                  )}
                  <div className="text-[11px] text-indigo-300">
                    Scheme: {evaluationScheme} • Contributes {internalContributed.toFixed(1)} / {cieWeight} pts
                  </div>
                  <p className="text-xs text-indigo-200 pt-0.5">
                    {marksNeededInSeeScale > seeWeight ? (
                      <span className="text-rose-400 font-bold">
                        ⚠️ Requires {neededIn100}/100 in End-Terms to reach {targetDesiredGrade}%. Maximize final prep!
                      </span>
                    ) : (
                      <span>
                        🎯 In ETT Finals, score at least <strong className="text-white font-mono">{neededIn50}/50</strong> (or <strong className="text-white font-mono">{neededIn100}/100</strong>) to hit your {targetDesiredGrade}% target!
                      </span>
                    )}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ADD / EDIT EXAM MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div 
            className="w-full max-w-xl rounded-3xl p-6 sm:p-7 border shadow-2xl relative my-8"
            style={{
              backgroundColor: theme.headerBg,
              borderColor: theme.cardBorder,
            }}
          >
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div 
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md bg-rose-500"
              >
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  {editingExam ? 'Edit Examination' : 'Schedule University Examination'}
                </h3>
                <p className="text-xs text-slate-400">
                  Configure theory vs. practical category, venue, and syllabus unit checklists.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveExam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Exam Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mid-Term Test 1 (MTT 1) or Lab Final Viva"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Course / Subject
                  </label>
                  <select
                    value={formCourseId}
                    onChange={(e) => setFormCourseId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                  >
                    <option value="" className="bg-slate-900">General / None</option>
                    {state.courses.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-900">
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Exam Category *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as ExamCategory)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                  >
                    <option value="mtt" className="bg-slate-900">MTT (Mid-Term Test)</option>
                    <option value="ett" className="bg-slate-900">ETT (End-Term Finals)</option>
                    <option value="ca" className="bg-slate-900">CA / Class Test</option>
                    <option value="viva" className="bg-slate-900">Lab Viva / Oral</option>
                    <option value="quiz" className="bg-slate-900">Quiz / Surprise Test</option>
                    <option value="project" className="bg-slate-900">Project Review / Jury</option>
                    <option value="backlog" className="bg-slate-900">Backlog / Supplementary</option>
                    <option value="other" className="bg-slate-900">Other Exam</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Exam Type *
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as ExamType)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                  >
                    <option value="theory" className="bg-slate-900">Theory</option>
                    <option value="practical" className="bg-slate-900">Practical / Lab</option>
                    <option value="hybrid" className="bg-slate-900">Hybrid</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Exam Date *
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Room / Lab Venue
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Hall 402 or Network Lab"
                    value={formRoomOrLab}
                    onChange={(e) => setFormRoomOrLab(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Desk / Seat #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Desk B-14"
                    value={formSeatNumber}
                    onChange={(e) => setFormSeatNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Session
                  </label>
                  <select
                    value={formSession}
                    onChange={(e) => setFormSession(e.target.value as 'morning' | 'afternoon')}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                  >
                    <option value="morning" className="bg-slate-900">Morning (FN)</option>
                    <option value="afternoon" className="bg-slate-900">Afternoon (AN)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Maximum Marks
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 50"
                    value={formMaxMarks}
                    onChange={(e) => setFormMaxMarks(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Marks Obtained
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormIsResultAwaiting(!formIsResultAwaiting)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border transition-all ${
                        formIsResultAwaiting
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {formIsResultAwaiting ? '⏳ Results Awaiting' : '✅ Marks Declared'}
                    </button>
                  </div>
                  {formIsResultAwaiting ? (
                    <div className="w-full px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      Paper submitted • Marks awaiting declaration
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 42"
                      value={formMarksObtained}
                      onChange={(e) => setFormMarksObtained(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-mono focus:outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Syllabus Units Builder */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Syllabus Units & Topics</span>
                  <span className="text-[10px] text-slate-400">Checklist for revision progress</span>
                </label>

                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Add topic (e.g. Unit 3: Graph Algorithms)"
                    value={newUnitInput}
                    onChange={(e) => setNewUnitInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newUnitInput.trim()) {
                          setFormUnits((prev) => [
                            ...prev,
                            { id: `u_${Date.now()}`, title: newUnitInput.trim(), completed: false },
                          ]);
                          setNewUnitInput('');
                        }
                      }
                    }}
                    className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newUnitInput.trim()) {
                        setFormUnits((prev) => [
                          ...prev,
                          { id: `u_${Date.now()}`, title: newUnitInput.trim(), completed: false },
                        ]);
                        setNewUnitInput('');
                      }
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold bg-white/10 text-white hover:bg-white/20"
                  >
                    + Add
                  </button>
                </div>

                {formUnits.length > 0 && (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {formUnits.map((u, idx) => (
                      <div key={u.id} className="flex items-center justify-between p-2 rounded-xl bg-white/5 text-xs text-slate-200">
                        <span>{u.title}</span>
                        <button
                          type="button"
                          onClick={() => setFormUnits((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-rose-400 hover:text-rose-300 text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Notes & Key Reminders
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Bring non-programmable scientific calculator, admit card required"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md"
                  style={{ backgroundColor: theme.accent }}
                >
                  {editingExam ? 'Save Changes' : 'Schedule Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}