import { useState } from 'react';
import { StudentData, AttendanceRecord, AttendanceStatus, Course } from '../types';
import { THEMES } from '../styles/themes';
import { 
  X, 
  Calendar, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  MinusCircle, 
  Plus, 
  Filter, 
  Clock, 
  Check, 
  Info,
  Download,
  Printer,
  FileText
} from 'lucide-react';

interface AttendanceHistoryModalProps {
  state: StudentData;
  onClose: () => void;
  onLogAttendance: (courseId: string, status: AttendanceStatus, date?: string, note?: string, documentRef?: string) => void;
  onDeleteRecord: (recordId: string) => void;
}

export function AttendanceHistoryModal({
  state,
  onClose,
  onLogAttendance,
  onDeleteRecord,
}: AttendanceHistoryModalProps) {
  const theme = THEMES[state.theme] || THEMES['dark-slate'];
  const courseMap = new Map<string, Course>(state.courses.map((c) => [c.id, c]));

  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [isBackfilling, setIsBackfilling] = useState(false);

  // Form state for backfilling past date
  const [backfillCourseId, setBackfillCourseId] = useState(state.courses[0]?.id || '');
  const [backfillDate, setBackfillDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [backfillStatus, setBackfillStatus] = useState<AttendanceStatus>('present');
  const [backfillNote, setBackfillNote] = useState('');
  const [backfillDocRef, setBackfillDocRef] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const filteredRecords = state.attendanceRecords.filter((rec) => {
    if (selectedCourseFilter !== 'all' && rec.courseId !== selectedCourseFilter) return false;
    if (selectedStatusFilter !== 'all' && rec.status !== selectedStatusFilter) return false;
    return true;
  });

  const totalLogged = state.attendanceRecords.length;
  const presentCount = state.attendanceRecords.filter((r) => r.status === 'present').length;
  const absentCount = state.attendanceRecords.filter((r) => r.status === 'absent').length;
  const excusedCount = state.attendanceRecords.filter((r) => r.status === 'excused').length;
  const cancelledCount = state.attendanceRecords.filter((r) => r.status === 'cancelled').length;
  const countedClasses = presentCount + absentCount;
  const overallPct = countedClasses > 0 ? Math.round((presentCount / countedClasses) * 100) : 100;

  const handleBackfillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!backfillCourseId) return;
    onLogAttendance(
      backfillCourseId, 
      backfillStatus, 
      backfillDate, 
      backfillNote.trim() || undefined,
      backfillDocRef.trim() || undefined
    );
    setSavedNotice(true);
    setBackfillNote('');
    setBackfillDocRef('');
    setTimeout(() => {
      setSavedNotice(false);
      setIsBackfilling(false);
    }, 800);
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Course Code', 'Course Name', 'Status', 'Note', 'Document / Proof Reference'];
    const rows = state.attendanceRecords.map((r) => {
      const c = courseMap.get(r.courseId);
      return [
        `"${r.date}"`,
        `"${c ? c.code : ''}"`,
        `"${c ? c.name.replace(/"/g, '""') : ''}"`,
        `"${r.status}"`,
        `"${(r.note || '').replace(/"/g, '""')}"`,
        `"${(r.documentRef || '').replace(/"/g, '""')}"`,
      ].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `attendance_log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrintStatement = () => {
    window.print();
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Present
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Absent
          </span>
        );
      case 'excused':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/20" title="Excused Absence / OD / Medical Leave (Does not penalize percentage)">
            <ShieldAlert className="w-3.5 h-3.5" /> Excused / OD
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/20">
            <MinusCircle className="w-3.5 h-3.5" /> Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/20">
            {status}
          </span>
        );
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
          className="absolute right-6 top-6 p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div 
            className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md"
            style={{ backgroundColor: theme.accent, color: '#fff' }}
          >
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight" style={{ color: theme.textPrimary }}>
              Attendance History & Audit Log
            </h2>
            <p className="text-xs text-slate-400">
              Browse historical class logs, backfill missed sessions, or adjust erroneous entries.
            </p>
          </div>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-6">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Logged</p>
            <p className="text-lg font-extrabold text-white mt-0.5">{totalLogged}</p>
          </div>
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Attended</p>
            <p className="text-lg font-extrabold text-emerald-300 mt-0.5">{presentCount}</p>
          </div>
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">Absences</p>
            <p className="text-lg font-extrabold text-rose-300 mt-0.5">{absentCount}</p>
          </div>
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">Excused / OD</p>
            <p className="text-lg font-extrabold text-amber-300 mt-0.5">{excusedCount}</p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-500/10 border border-slate-500/20 text-center col-span-2 sm:col-span-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Not Conducted</p>
            <p className="text-lg font-extrabold text-slate-300 mt-0.5">{cancelledCount}</p>
          </div>
        </div>

        {state.courses.some(c => (c.baselineClassesHeld || 0) > 0) && (
          <div className="mb-5 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              Prior to joining, you have <strong className="text-white font-mono">{state.courses.reduce((acc, c) => acc + (c.baselineAttendedClasses || 0), 0)}/{state.courses.reduce((acc, c) => acc + (c.baselineClassesHeld || 0), 0)}</strong> classes in your college ERP baseline. The audit log below records daily class sessions tracked inside AcademiaSync.
            </span>
          </div>
        )}

        {/* Actions & Filters Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              <span>Course:</span>
            </div>
            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
            >
              <option value="all" className="bg-slate-900">All Courses ({state.courses.length})</option>
              {state.courses.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900">
                  {c.code} – {c.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
            >
              <option value="all" className="bg-slate-900">All Statuses</option>
              <option value="present" className="bg-slate-900">Present Only</option>
              <option value="absent" className="bg-slate-900">Absent Only</option>
              <option value="excused" className="bg-slate-900">Excused / OD</option>
              <option value="cancelled" className="bg-slate-900">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            <button
              type="button"
              onClick={handleExportCSV}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 flex items-center gap-1.5 transition-colors"
              title="Download official CSV attendance log for disputes or dean approval"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>CSV Log</span>
            </button>

            <button
              type="button"
              onClick={handlePrintStatement}
              className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 flex items-center gap-1.5 transition-colors"
              title="Print formal attendance statement"
            >
              <Printer className="w-3.5 h-3.5 text-slate-300" />
              <span>Print</span>
            </button>

            <button
              onClick={() => setIsBackfilling(!isBackfilling)}
              className="text-xs font-bold px-3.5 py-1.5 rounded-xl text-white shadow-md flex items-center gap-1.5 transition-transform active:scale-95"
              style={{ backgroundColor: isBackfilling ? '#475569' : theme.accent }}
            >
              {isBackfilling ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {isBackfilling ? 'Cancel' : 'Log Past Date'}
            </button>
          </div>
        </div>

        {/* Backfill Past Date Form (Collapsible) */}
        {isBackfilling && (
          <form 
            onSubmit={handleBackfillSubmit}
            className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3 animate-fadeIn"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Log Past Session
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Course *</label>
                <select
                  value={backfillCourseId}
                  onChange={(e) => setBackfillCourseId(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none"
                >
                  {state.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}: {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Date *</label>
                <input
                  type="date"
                  value={backfillDate}
                  onChange={(e) => setBackfillDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  required
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Attendance Status *</label>
                <select
                  value={backfillStatus}
                  onChange={(e) => setBackfillStatus(e.target.value as AttendanceStatus)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none"
                >
                  <option value="present">Present (Attended)</option>
                  <option value="absent">Absent (Bunked / Missed)</option>
                  <option value="excused">Excused / OD (Medical / Official)</option>
                  <option value="cancelled">Cancelled (No Lecture Held)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Hackathon Duty Leave, Fever, Professor substitute"
                  value={backfillNote}
                  onChange={(e) => setBackfillNote(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Proof / Document Reference (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. OD Slip #401, Medical Certificate link"
                  value={backfillDocRef}
                  onChange={(e) => setBackfillDocRef(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsBackfilling(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-1.5"
                style={{ backgroundColor: theme.accent }}
              >
                {savedNotice ? <Check className="w-3.5 h-3.5" /> : null}
                {savedNotice ? 'Recorded!' : 'Save Entry'}
              </button>
            </div>
          </form>
        )}

        {/* Attendance Records List */}
        <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
          {filteredRecords.length > 0 ? (
            filteredRecords.map((rec) => {
              const course = courseMap.get(rec.courseId);
              return (
                <div
                  key={rec.id}
                  className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/15 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-2.5 h-10 rounded-full shrink-0"
                      style={{ backgroundColor: course?.color || '#3b82f6' }}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-xs text-white">
                          {course ? course.code : 'Course'}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {rec.date}
                        </span>
                        {getStatusBadge(rec.status)}
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {course?.name || 'Class Session'}
                        {rec.note && <span className="text-slate-300 italic ml-2">• "{rec.note}"</span>}
                        {rec.documentRef && (
                          <span className="text-indigo-300 ml-2 font-mono text-[10px] bg-indigo-500/15 px-1.5 py-0.5 rounded border border-indigo-500/20">
                            📎 {rec.documentRef}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (window.confirm(`Delete attendance entry for ${course?.code || 'course'} on ${rec.date}? This will re-adjust your attendance count.`)) {
                        onDeleteRecord(rec.id);
                      }
                    }}
                    className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors shrink-0"
                    title="Delete Record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-500">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">No attendance records match your current filter.</p>
              <p className="text-[11px] text-slate-600 mt-0.5">Use "Log Past Date" or mark classes on your timetable to record entries.</p>
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            Excused absences (OD / Medical Leave) do not lower your attendance percentage.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
