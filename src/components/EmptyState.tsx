import { BookOpen, Calendar, CheckSquare, Plus, Sparkles } from 'lucide-react';
import { THEMES } from '../styles/themes';
import { ThemeKey } from '../types';

interface EmptyStateProps {
  type: 'courses' | 'slots' | 'tasks' | 'attendance' | 'exams';
  themeKey: ThemeKey;
  onAction: () => void;
  studentName: string;
}

export function EmptyState({ type, themeKey, onAction, studentName }: EmptyStateProps) {
  const theme = THEMES[themeKey] || THEMES['dark-slate'];

  if (type === 'courses') {
    return (
      <div 
        className="rounded-3xl p-8 sm:p-12 text-center border shadow-xl relative overflow-hidden"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
        }}
      >
        <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
          <BookOpen className="w-8 h-8" />
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
          Clean Slate Setup
        </span>
        <h2 className="text-2xl font-black mt-3" style={{ color: theme.textPrimary }}>
          Welcome to your semester, {studentName.split(' ')[0]}! 🎓
        </h2>
        <p className="text-xs sm:text-sm max-w-md mx-auto mt-2" style={{ color: theme.textSecondary }}>
          Your timetable is completely fresh and blank. Start by registering your courses/subjects for this semester to unlock attendance tracking and timetable management.
        </p>

        <div className="mt-6 flex justify-center">
          <button
            onClick={onAction}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-bold text-white shadow-xl hover:scale-105 transition-all"
            style={{
              backgroundColor: theme.accent,
              boxShadow: `0 0 20px ${theme.accentGlow}`,
            }}
          >
            <Plus className="w-4 h-4" />
            Add Your First Course / Subject
          </button>
        </div>
      </div>
    );
  }

  if (type === 'slots') {
    return (
      <div 
        className="rounded-3xl p-8 text-center border"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
        }}
      >
        <Calendar className="w-12 h-12 text-sky-400 mx-auto mb-3 opacity-80" />
        <h3 className="text-base font-bold" style={{ color: theme.textPrimary }}>
          No Class Slots Added Yet
        </h3>
        <p className="text-xs max-w-sm mx-auto mt-1" style={{ color: theme.textSecondary }}>
          Add your weekly lectures, lab sessions, and tutorials to see your live class ticker and weekly schedule.
        </p>
        <button
          onClick={onAction}
          className="mt-4 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md hover:scale-105 transition-all"
          style={{ backgroundColor: theme.accent }}
        >
          <Plus className="w-3.5 h-3.5 inline mr-1" />
          Schedule a Class Slot
        </button>
      </div>
    );
  }

  if (type === 'tasks') {
    return (
      <div 
        className="rounded-3xl p-8 text-center border"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
        }}
      >
        <CheckSquare className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-80" />
        <h3 className="text-base font-bold" style={{ color: theme.textPrimary }}>
          No Tasks or Deadlines Yet
        </h3>
        <p className="text-xs max-w-sm mx-auto mt-1" style={{ color: theme.textSecondary }}>
          Stay ahead of your college coursework by adding upcoming assignments, project deadlines, and quizzes.
        </p>
        <button
          onClick={onAction}
          className="mt-4 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md hover:scale-105 transition-all"
          style={{ backgroundColor: theme.accent }}
        >
          <Plus className="w-3.5 h-3.5 inline mr-1" />
          Create First Task
        </button>
      </div>
    );
  }

  return null;
}
