import { useState, useEffect } from 'react';
import { StudentData, Task } from '../types';
import { THEMES } from '../styles/themes';
import { 
  Flame, 
  Plus, 
  CheckCircle2, 
  GraduationCap
} from 'lucide-react';
import { formatTime12h } from '../utils/timeUtils';

interface ExamCountdownHubProps {
  state: StudentData;
  onOpenAddModal: () => void;
  onUpdateTask: (task: Task) => void;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
}

function calculateTimeLeft(targetDate: string, targetTime: string = '09:00'): TimeRemaining {
  const [y, m, d] = targetDate.split('-').map(Number);
  const [hh, mm] = targetTime.split(':').map(Number);
  const target = new Date(y, m - 1, d, hh || 9, mm || 0, 0).getTime();
  const now = new Date().getTime();
  const diff = target - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, isPast: false };
}

export function ExamCountdownHub({
  state,
  onOpenAddModal,
  onUpdateTask,
}: ExamCountdownHubProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const theme = THEMES[state.theme] || THEMES['dark-slate'];
  const courseMap = new Map(state.courses.map((c) => [c.id, c]));

  // Get all exams, quizzes, and project submission tasks
  const examTasks = state.tasks
    .filter((t) => t.category === 'exam' || t.category === 'quiz' || t.category === 'project')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl border"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
        }}
      >
        <div>
          <h2 className="text-xl sm:text-2xl font-black flex items-center gap-2" style={{ color: theme.textPrimary }}>
            <Flame className="w-6 h-6 text-rose-500 animate-pulse" />
            Exam & Project Countdown Hub
          </h2>
          <p className="text-xs font-medium mt-1" style={{ color: theme.textSecondary }}>
            Keep track of every upcoming midterm, final exam, viva, and project deadline with live precision countdowns.
          </p>
        </div>

        <button
          onClick={onOpenAddModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-transform hover:scale-105"
          style={{
            backgroundColor: theme.accent,
            boxShadow: `0 0 12px ${theme.accentGlow}`,
          }}
        >
          <Plus className="w-4 h-4" />
          Schedule Exam / Viva
        </button>
      </div>

      {/* Countdown Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {examTasks.map((exam) => {
          const course = exam.courseId ? courseMap.get(exam.courseId) : null;
          const timeLeft = calculateTimeLeft(exam.dueDate, exam.dueTime || '09:00');
          const completedSubtasks = exam.subtasks?.filter((s) => s.completed).length || 0;
          const totalSubtasks = exam.subtasks?.length || 0;

          return (
            <div
              key={exam.id}
              className="rounded-3xl p-6 border shadow-xl flex flex-col justify-between relative overflow-hidden transition-all hover:translate-y-[-2px]"
              style={{
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
              }}
            >
              {/* Background ambient badge */}
              <div 
                className="absolute right-0 top-0 w-32 h-32 rounded-full blur-3xl opacity-15 pointer-events-none"
                style={{ backgroundColor: course ? course.color : theme.accent }}
              />

              <div>
                {/* Header tags */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                      {exam.category === 'exam' ? '🎓 Final / Midterm' : exam.category === 'quiz' ? '📝 Quiz' : '🚀 Term Project'}
                    </span>
                    {course && (
                      <span 
                        className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md text-white shadow-sm"
                        style={{ backgroundColor: course.color }}
                      >
                        {course.code}
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-mono font-bold text-amber-400">
                    📅 {exam.dueDate}
                  </span>
                </div>

                {/* Exam Title */}
                <h3 className="text-xl font-bold" style={{ color: theme.textPrimary }}>
                  {exam.title}
                </h3>
                {course && (
                  <p className="text-xs font-medium text-slate-400 mt-1">
                    Course: {course.name} {course.professor ? `• Prof. ${course.professor}` : ''}
                  </p>
                )}

                {/* LIVE COUNTDOWN TICKER BOX */}
                <div className="mt-5 p-4 rounded-2xl bg-white/5 border border-white/10">
                  {timeLeft.isPast ? (
                    <div className="text-center py-2 text-emerald-400 font-bold text-sm">
                      ✓ Exam Completed or Concluded
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-white/5">
                        <span className="block text-2xl font-black font-mono text-white">
                          {timeLeft.days}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Days</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white/5">
                        <span className="block text-2xl font-black font-mono text-amber-400">
                          {timeLeft.hours}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Hours</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white/5">
                        <span className="block text-2xl font-black font-mono text-sky-400">
                          {timeLeft.minutes}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Mins</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white/5">
                        <span className="block text-2xl font-black font-mono text-rose-400">
                          {timeLeft.seconds}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Secs</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Syllabus Checklist if provided */}
                {totalSubtasks > 0 && (
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-400">
                      <span>Syllabus & Prep Checklist</span>
                      <span>{completedSubtasks}/{totalSubtasks} topics done</span>
                    </div>
                    {exam.subtasks!.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => {
                          const updated = exam.subtasks!.map((s) => (s.id === st.id ? { ...s, completed: !s.completed } : s));
                          onUpdateTask({ ...exam, subtasks: updated });
                        }}
                        className="flex items-center gap-2 text-xs cursor-pointer py-1 text-slate-300 hover:text-white"
                      >
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                          st.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-500'
                        }`}>
                          {st.completed && <CheckCircle2 className="w-3 h-3" />}
                        </div>
                        <span className={st.completed ? 'line-through text-slate-500' : ''}>
                          {st.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer status */}
              <div className="mt-5 pt-3 border-t flex items-center justify-between text-xs"
                style={{ borderColor: 'rgba(255,255,255,0.06)' }}
              >
                <span className="text-slate-400">
                  Starts at: {exam.dueTime ? formatTime12h(exam.dueTime) : '09:00 AM'}
                </span>
                <span className="font-bold text-rose-400">
                  Priority: {exam.priority.toUpperCase()}
                </span>
              </div>
            </div>
          );
        })}

        {examTasks.length === 0 && (
          <div className="col-span-full p-12 rounded-3xl border text-center"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
          >
            <GraduationCap className="w-12 h-12 text-indigo-400 mx-auto mb-3 opacity-80" />
            <h3 className="font-bold text-base" style={{ color: theme.textPrimary }}>
              No exams or major project deadlines currently logged
            </h3>
            <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: theme.textSecondary }}>
              Click "Schedule Exam / Viva" to add your upcoming midterms and finals so you never miss a study deadline.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
