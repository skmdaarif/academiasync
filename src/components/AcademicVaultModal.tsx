import React, { useState } from 'react';
import { UserAccount, StudentData, AcademicSemester } from '../types';
import { THEMES } from '../styles/themes';
import { 
  X, 
  Award, 
  BookOpen, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Edit3, 
  Plus, 
  ShieldCheck, 
  TrendingUp, 
  History,
  Save,
  Check,
  FileText
} from 'lucide-react';

interface AcademicVaultModalProps {
  user: UserAccount;
  state: StudentData;
  onClose: () => void;
  onSelectSemesterForViewing: (semNumber: number) => void;
  onUpdateSemesters: (semesters: AcademicSemester[]) => Promise<void>;
  onOpenPromoteModal: () => void;
}

export function AcademicVaultModal({
  user,
  state,
  onClose,
  onSelectSemesterForViewing,
  onUpdateSemesters,
  onOpenPromoteModal,
}: AcademicVaultModalProps) {
  const theme = THEMES[state.theme] || THEMES['dark-slate'];

  const totalClasses = state.courses.reduce((acc, c) => acc + (c.totalClasses || 0) + (c.baselineClassesHeld || 0), 0);
  const totalAttended = state.courses.reduce((acc, c) => acc + (c.attendedClasses || 0) + (c.baselineAttendedClasses || 0), 0);
  const dynamicCurrentPct = totalClasses > 0 
    ? Math.round((totalAttended / totalClasses) * 1000) / 10 
    : (user.initialAttendancePct ?? 85);

  const semestersList = state.semesters && state.semesters.length > 0
    ? [...state.semesters].sort((a, b) => a.semesterNumber - b.semesterNumber)
    : [{
        id: 'sem_current',
        semesterNumber: user.activeSemesterNumber || 1,
        title: user.semester || `Semester ${user.activeSemesterNumber || 1}`,
        status: 'active' as const,
        creditsEarned: state.courses.reduce((acc, c) => acc + (c.credits || 3), 0),
        finalAttendancePct: dynamicCurrentPct,
      }];

  const [editingSemNumber, setEditingSemNumber] = useState<number | null>(null);
  const [editAttendance, setEditAttendance] = useState<number>(80);
  const [editCredits, setEditCredits] = useState<number>(20);
  const [editSgpa, setEditSgpa] = useState<string>('');
  const [editMarksheetRef, setEditMarksheetRef] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [showSgpaSimulator, setShowSgpaSimulator] = useState(false);

  const activeSemNumber = user.activeSemesterNumber || 1;
  const activeCourses = state.courses.filter((c) => (c.semesterNumber || 1) === activeSemNumber);
  const [predictedGrades, setPredictedGrades] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    activeCourses.forEach((c) => {
      initial[c.id] = 8; // Default 'A' (8.0 grade point)
    });
    return initial;
  });

  // Calculate Predicted SGPA
  const simTotalCredits = activeCourses.reduce((acc, c) => acc + (c.credits || 3), 0);
  const simWeightedPoints = activeCourses.reduce((acc, c) => {
    const gp = predictedGrades[c.id] !== undefined ? predictedGrades[c.id] : 8;
    return acc + (c.credits || 3) * gp;
  }, 0);
  const simulatedSgpa = simTotalCredits > 0 ? Math.round((simWeightedPoints / simTotalCredits) * 100) / 100 : null;

  // Compute Degree Lifetime Stats
  const totalCredits = semestersList.reduce((acc, s) => acc + (s.creditsEarned || 0), 0);
  
  const semestersWithAttendance = semestersList.filter((s) => s.finalAttendancePct !== undefined && s.finalAttendancePct !== null);
  const avgAttendance = semestersWithAttendance.length > 0
    ? semestersWithAttendance.reduce((acc, s) => acc + (s.finalAttendancePct || 0), 0) / semestersWithAttendance.length
    : 0;

  const semestersWithSgpa = semestersList.filter((s) => s.sgpa !== undefined && s.sgpa !== null && s.sgpa > 0);
  const totalWeightedCredits = semestersWithSgpa.reduce((acc, s) => acc + (s.creditsEarned || 0), 0);
  const cgpa = semestersWithSgpa.length > 0
    ? totalWeightedCredits > 0
      ? semestersWithSgpa.reduce((acc, s) => acc + (s.sgpa || 0) * (s.creditsEarned || 0), 0) / totalWeightedCredits
      : semestersWithSgpa.reduce((acc, s) => acc + (s.sgpa || 0), 0) / semestersWithSgpa.length
    : null;

  const handleStartEdit = (sem: AcademicSemester) => {
    setEditingSemNumber(sem.semesterNumber);
    setEditAttendance(sem.finalAttendancePct ?? 80);
    setEditCredits(sem.creditsEarned || 20);
    setEditSgpa(sem.sgpa !== undefined ? String(sem.sgpa) : '');
    setEditMarksheetRef(sem.marksheetRef || '');
    setEditNotes(sem.notes || '');
  };

  const handleSaveEdit = async (sem: AcademicSemester) => {
    setIsSaving(true);
    try {
      const parsedSgpa = parseFloat(editSgpa);
      const updatedList = semestersList.map((s) => {
        if (s.semesterNumber === sem.semesterNumber) {
          return {
            ...s,
            finalAttendancePct: Number(editAttendance) || 0,
            creditsEarned: Number(editCredits) || 0,
            sgpa: !isNaN(parsedSgpa) && parsedSgpa > 0 ? parsedSgpa : undefined,
            marksheetRef: editMarksheetRef.trim() || undefined,
            notes: editNotes.trim() || undefined,
          };
        }
        return s;
      });

      await onUpdateSemesters(updatedList);
      setEditingSemNumber(null);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 2500);
    } catch (err) {
      console.error('Failed to update semester in vault:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="w-full max-w-3xl rounded-3xl p-6 sm:p-8 border shadow-2xl relative my-8"
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
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div 
              className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg"
              style={{ backgroundColor: theme.accent }}
            >
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight" style={{ color: theme.textPrimary }}>
                  Academic Performance Vault
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  Lifetime History
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Track cumulative degree credits, past semester attendances & CGPA progression.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              onOpenPromoteModal();
            }}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition-all flex items-center gap-1.5 shrink-0"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Promote to Next Sem →</span>
          </button>
        </div>

        {successToast && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>Semester performance record updated successfully!</span>
          </div>
        )}

        {/* Overall Lifetime KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">
              Total Credits
            </span>
            <div className="text-xl font-black text-white mt-1">
              {totalCredits} <span className="text-xs font-medium text-slate-400">Cr</span>
            </div>
            <span className="text-[10px] text-indigo-400 mt-0.5 block">Across all sems</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">
              Avg Attendance
            </span>
            <div className="text-xl font-black text-white mt-1">
              {avgAttendance > 0 ? `${avgAttendance.toFixed(1)}%` : 'N/A'}
            </div>
            <span className="text-[10px] text-emerald-400 mt-0.5 block">Lifetime aggregate</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">
              Overall CGPA
            </span>
            <div className="text-xl font-black text-white mt-1">
              {cgpa ? cgpa.toFixed(2) : '—'}
            </div>
            <span className="text-[10px] text-amber-400 mt-0.5 block">
              {semestersWithSgpa.length} sems recorded
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10">
            <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">
              Semesters
            </span>
            <div className="text-xl font-black text-white mt-1">
              {semestersList.length} <span className="text-xs font-medium text-slate-400">/ {user.totalSemesters || 8}</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Current: Sem {user.activeSemesterNumber || 1}
            </span>
          </div>
        </div>

        {/* Active Semester SGPA Simulator & Forecast */}
        <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white">
                Semester {activeSemNumber} SGPA Forecast & Simulator
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSgpaSimulator(!showSgpaSimulator)}
              className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300"
            >
              {showSgpaSimulator ? 'Collapse ▲' : 'Simulate Grades ▼'}
            </button>
          </div>

          {showSgpaSimulator && (
            <div className="mt-3 space-y-3 pt-3 border-t border-white/5">
              <p className="text-[11px] text-slate-300">
                Assign your projected letter grades to active courses to simulate your term SGPA ({simTotalCredits} total credits):
              </p>

              {activeCourses.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {activeCourses.map((c) => (
                    <div key={c.id} className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">{c.code}</span>
                        <span className="text-[10px] text-slate-400">{c.credits || 3} Credits</span>
                      </div>

                      <select
                        value={predictedGrades[c.id] ?? 8}
                        onChange={(e) => setPredictedGrades({ ...predictedGrades, [c.id]: Number(e.target.value) })}
                        className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-900 border border-white/10 text-amber-400 focus:outline-none"
                      >
                        <option value="10">O (10.0)</option>
                        <option value="9">A+ (9.0)</option>
                        <option value="8">A (8.0)</option>
                        <option value="7">B+ (7.0)</option>
                        <option value="6">B (6.0)</option>
                        <option value="5">C (5.0)</option>
                        <option value="4">P (4.0)</option>
                        <option value="0">F (0.0)</option>
                      </select>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No courses registered in active semester yet.</p>
              )}

              {simulatedSgpa !== null && activeCourses.length > 0 && (
                <div className="p-3 rounded-xl bg-black/40 border border-indigo-500/30 flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">
                      Forecasted Sem {activeSemNumber} SGPA
                    </span>
                    <span className="text-lg font-black text-amber-400 font-mono">
                      {simulatedSgpa.toFixed(2)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      const activeSemIdx = semestersList.findIndex((s) => s.semesterNumber === activeSemNumber);
                      if (activeSemIdx !== -1) {
                        const updated = [...semestersList];
                        updated[activeSemIdx] = {
                          ...updated[activeSemIdx],
                          sgpa: simulatedSgpa,
                          creditsEarned: simTotalCredits,
                        };
                        await onUpdateSemesters(updated);
                        setSuccessToast(true);
                        setTimeout(() => setSuccessToast(false), 2000);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow transition-all"
                  >
                    Save as Sem {activeSemNumber} SGPA
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Semesters History Timeline */}
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1">
            <span>Semester Breakdown</span>
            <span className="text-[11px] text-slate-400 font-normal">Click a semester to view archive timetable</span>
          </div>

          {semestersList.map((sem) => {
            const isActive = sem.status === 'active';
            const isEditing = editingSemNumber === sem.semesterNumber;

            return (
              <div 
                key={sem.semesterNumber} 
                className={`p-4 rounded-2xl border transition-all ${
                  isActive
                    ? 'bg-indigo-950/30 border-indigo-500/40 shadow-sm'
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                {isEditing ? (
                  /* Edit Mode */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">Edit {sem.title} Performance</span>
                      <button
                        onClick={() => setEditingSemNumber(null)}
                        className="text-[11px] text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Final Attendance %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={editAttendance}
                          onChange={(e) => setEditAttendance(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Credits Earned</label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={editCredits}
                          onChange={(e) => setEditCredits(parseInt(e.target.value, 10) || 0)}
                          className="w-full px-2 py-1.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">SGPA (e.g. 8.5)</label>
                        <input
                          type="text"
                          value={editSgpa}
                          onChange={(e) => setEditSgpa(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="url"
                        placeholder="Link to Grade Card / Marksheet (Drive/PDF)"
                        value={editMarksheetRef}
                        onChange={(e) => setEditMarksheetRef(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-400"
                      />
                      <input
                        type="text"
                        placeholder="Optional notes or remarks"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="w-full px-2.5 py-1 text-xs rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-400"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(sem)}
                        disabled={isSaving}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-sm flex items-center gap-1.5"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSaving ? 'Saving...' : 'Save Performance'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isActive 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-white/10 text-slate-300'
                      }`}>
                        S{sem.semesterNumber}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{sem.title}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full uppercase tracking-wider ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : sem.status === 'archived'
                              ? 'bg-indigo-500/20 text-indigo-400'
                              : 'bg-slate-500/20 text-slate-400'
                          }`}>
                            {sem.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {sem.creditsEarned} Credits Earned
                          {sem.sgpa ? ` • SGPA: ${sem.sgpa}` : ''}
                          {sem.finalAttendancePct !== undefined && sem.finalAttendancePct !== null
                            ? ` • Attendance: ${sem.finalAttendancePct.toFixed(1)}%`
                            : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                      {sem.marksheetRef && (
                        <a
                          href={sem.marksheetRef}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-colors flex items-center gap-1"
                          title="Open official semester marksheet / grade card"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Marksheet</span>
                        </a>
                      )}

                      <button
                        onClick={() => {
                          onSelectSemesterForViewing(sem.semesterNumber);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                      >
                        {isActive ? 'View Live' : 'View Snapshot'}
                      </button>

                      <button
                        onClick={() => handleStartEdit(sem)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-white/5 transition-colors"
                        title="Edit Marks & Attendance"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
