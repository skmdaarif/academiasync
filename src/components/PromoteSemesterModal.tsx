import React, { useState } from 'react';
import { UserAccount, StudentData, Course } from '../types';
import { THEMES } from '../styles/themes';
import { X, Sparkles, Award, CheckCircle2, ArrowRight, ShieldCheck, FileText } from 'lucide-react';

interface PromoteSemesterModalProps {
  user: UserAccount;
  state: StudentData;
  onClose: () => void;
  onPromote: (
    nextSemesterNumber: number,
    summary: { finalAttendancePct?: number; creditsEarned: number; sgpa?: number; notes?: string }
  ) => Promise<void>;
  onOpenPdfScanner?: () => void;
}

export function PromoteSemesterModal({
  user,
  state,
  onClose,
  onPromote,
  onOpenPdfScanner,
}: PromoteSemesterModalProps) {
  const theme = THEMES[state.theme] || THEMES['dark-slate'];

  const currentSemNumber = user.activeSemesterNumber || parseInt(String(user.semester).replace(/\D/g, ''), 10) || 1;
  const nextSemNumber = currentSemNumber + 1;

  // Filter courses for current semester
  const currentSemesterCourses = state.courses.filter(
    (c) => (c.semesterNumber || 1) === currentSemNumber
  );

  // Compute stats for current semester
  const totalClassesHeld = currentSemesterCourses.reduce((acc, c) => acc + (c.totalClasses || 0), 0);
  const totalClassesAttended = currentSemesterCourses.reduce((acc, c) => acc + (c.attendedClasses || 0), 0);
  const calculatedAttendancePct = totalClassesHeld > 0 ? (totalClassesAttended / totalClassesHeld) * 100 : 85;
  const calculatedCredits = currentSemesterCourses.reduce((acc, c) => acc + (c.credits || 3), 0);

  const [finalAttendancePct, setFinalAttendancePct] = useState(parseFloat(calculatedAttendancePct.toFixed(1)));
  const [creditsEarned, setCreditsEarned] = useState(calculatedCredits || 20);
  const [sgpa, setSgpa] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const parsedSgpa = parseFloat(sgpa);
      await onPromote(nextSemNumber, {
        finalAttendancePct: Number(finalAttendancePct) || 0,
        creditsEarned: Number(creditsEarned) || 0,
        sgpa: !isNaN(parsedSgpa) && parsedSgpa > 0 ? parsedSgpa : undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to promote semester.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="w-full max-w-lg rounded-3xl p-6 sm:p-8 border shadow-2xl relative my-8"
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
          <div 
            className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg"
            style={{ backgroundColor: theme.accent }}
          >
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tight" style={{ color: theme.textPrimary }}>
                Promote to Semester {nextSemNumber}
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Academic Advancement
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Archive Semester {currentSemNumber} performance and unlock Semester {nextSemNumber}.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Transition Summary Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div className="text-left">
            <span className="text-[11px] font-medium text-slate-400">Closing Semester</span>
            <div className="text-sm font-bold text-slate-200">Semester {currentSemNumber}</div>
            <span className="text-[10px] text-amber-400">Will be archived in Vault</span>
          </div>
          <ArrowRight className="w-5 h-5 text-indigo-400 shrink-0" />
          <div className="text-right">
            <span className="text-[11px] font-medium text-slate-400">New Active Semester</span>
            <div className="text-sm font-bold text-emerald-400">Semester {nextSemNumber}</div>
            <span className="text-[10px] text-slate-400">Fresh Timetable Ready</span>
          </div>
        </div>

        {/* Closing Semester Details Form */}
        <form onSubmit={handleConfirm} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Final Attendance % *
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                required
                value={finalAttendancePct}
                onChange={(e) => setFinalAttendancePct(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Calculated: {calculatedAttendancePct.toFixed(1)}%
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Credits Earned *
              </label>
              <input
                type="number"
                min="0"
                max="50"
                required
                value={creditsEarned}
                onChange={(e) => setCreditsEarned(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Registered courses: {calculatedCredits} credits
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Semester SGPA (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. 8.75"
                value={sgpa}
                onChange={(e) => setSgpa(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Academic Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Cleared all subjects"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-start gap-2 mt-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Zero Data Loss Guarantee:</span>
              <p className="mt-0.5 text-slate-400">
                All lectures, attendance logs, and courses from Semester {currentSemNumber} remain permanently preserved in your Historical Vault. You can switch back and inspect them anytime!
              </p>
            </div>
          </div>

          <div className="pt-3 flex flex-col sm:flex-row items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-white/5 border border-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Advancing Semester...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Confirm Promotion to Semester {nextSemNumber}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
