import { useState } from 'react';
import { StudentData, UserAccount } from '../types';
import { THEMES } from '../styles/themes';
import { generateTimetableICS, generateTasksICS, downloadFile } from '../utils/calendarExport';
import { apiRestoreStudentData } from '../services/api';
import { 
  X, 
  Download, 
  Upload, 
  Calendar, 
  FileText, 
  Database, 
  Copy, 
  Check, 
  Printer, 
  ShieldAlert,
  Sparkles,
  Loader2
} from 'lucide-react';

interface ExportModalProps {
  user: UserAccount;
  state: StudentData;
  onClose: () => void;
  onRestoreState: (newState: StudentData) => void;
}

export function ExportModal({ user, state, onClose, onRestoreState }: ExportModalProps) {
  const [activeTab, setActiveTab] = useState<'calendar' | 'backup' | 'database'>('calendar');
  const [copiedSQL, setCopiedSQL] = useState(false);
  const [importError, setImportError] = useState('');

  const theme = THEMES[state.theme] || THEMES['dark-slate'];

  const [isRestoring, setIsRestoring] = useState(false);

  const handleExportTimetableICS = () => {
    const icsContent = generateTimetableICS(state.timeSlots, state.courses, user.semesterStartDate);
    downloadFile(icsContent, `college_timetable_${user.name.toLowerCase().replace(/\s+/g, '_')}.ics`);
  };

  const handleExportTasksICS = () => {
    const icsContent = generateTasksICS(state.tasks, state.courses);
    downloadFile(icsContent, `student_tasks_${user.name.toLowerCase().replace(/\s+/g, '_')}.ics`);
  };

  const handleExportJSON = () => {
    const backupObj = { user, data: state, exportedAt: new Date().toISOString() };
    const jsonStr = JSON.stringify(backupObj, null, 2);
    downloadFile(jsonStr, `academiasync_${user.name.toLowerCase().replace(/\s+/g, '_')}_backup.json`, 'application/json');
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        const dataToRestore = parsed.data && parsed.data.courses ? parsed.data : parsed.courses ? parsed : null;

        if (dataToRestore) {
          setIsRestoring(true);
          try {
            const res = await apiRestoreStudentData(user.id, dataToRestore);
            onRestoreState(res.data);
            onClose();
          } catch (dbErr: any) {
            // If offline, still apply to local session and warn user
            onRestoreState(dataToRestore);
            onClose();
          } finally {
            setIsRestoring(false);
          }
        } else {
          setImportError('Invalid backup file format. Please upload a valid AcademiaSync JSON file.');
        }
      } catch (err) {
        setImportError('Could not read or parse file.');
      }
    };
    reader.readAsText(file);
  };

  const sampleSQL = `-- Connect to your local SQLite file 'data/academiasync.db' (via sqlite3 CLI or VS Code SQLite extension)
-- Run queries for your individual student account:
SELECT c.code, c.name, ts.day_of_week, ts.start_time, ts.end_time, ts.room
FROM time_slots ts
JOIN courses c ON ts.course_id = c.id
WHERE ts.user_id = '${user.id}'
ORDER BY ts.start_time ASC;

-- Check your attendance analytics:
SELECT code, name, attended_classes, total_classes_held,
       ROUND((CAST(attended_classes AS REAL) / MAX(1, total_classes_held)) * 100, 1) AS attendance_percentage
FROM courses
WHERE user_id = '${user.id}';`;

  const handleCopySQL = () => {
    navigator.clipboard.writeText(sampleSQL);
    setCopiedSQL(true);
    setTimeout(() => setCopiedSQL(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="w-full max-w-2xl rounded-3xl p-6 sm:p-8 border shadow-2xl relative my-8"
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
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: theme.textPrimary }}>
              Export, Sync & Backup Center
            </h2>
            <p className="text-xs text-slate-400">
              Export to Google/Apple Calendar, backup data, or integrate with PostgreSQL.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1 rounded-2xl bg-white/5 border border-white/5 mb-6">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'calendar' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            style={{ backgroundColor: activeTab === 'calendar' ? theme.accent : 'transparent' }}
          >
            <Calendar className="w-3.5 h-3.5" />
            Calendar Sync & PDF
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'backup' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            style={{ backgroundColor: activeTab === 'backup' ? theme.accent : 'transparent' }}
          >
            <FileText className="w-3.5 h-3.5" />
            JSON Backup / Restore
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'database' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
            style={{ backgroundColor: activeTab === 'database' ? theme.accent : 'transparent' }}
          >
            <Database className="w-3.5 h-3.5" />
            SQLite DB Queries
          </button>
        </div>

        {/* TAB 1: CALENDAR SYNC & PDF */}
        {activeTab === 'calendar' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Google / Apple Calendar Timetable */}
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-sm" style={{ color: theme.textPrimary }}>
                    Sync Weekly Classes (.ics)
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Exports all your registered lecture & lab slots to Google Calendar, Apple Calendar, and Outlook.
                  </p>
                </div>
                <button
                  onClick={handleExportTimetableICS}
                  disabled={state.timeSlots.length === 0}
                  className="mt-4 w-full py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Timetable .ics
                </button>
              </div>

              {/* Tasks & Deadlines iCal */}
              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-2">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-sm" style={{ color: theme.textPrimary }}>
                    Sync Tasks & Deadlines (.ics)
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Exports upcoming assignments and exam reminder alarms directly to your calendar app.
                  </p>
                </div>
                <button
                  onClick={handleExportTasksICS}
                  disabled={state.tasks.length === 0}
                  className="mt-4 w-full py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Tasks .ics
                </button>
              </div>

            </div>

            {/* Print Timetable */}
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm" style={{ color: theme.textPrimary }}>
                  Print or Save as PDF
                </h4>
                <p className="text-xs text-slate-400">
                  Open the printable timetable schedule for this semester.
                </p>
              </div>
              <button
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-200 bg-white/10 hover:bg-white/20 transition-colors flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                Print / PDF
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: JSON BACKUP / RESTORE */}
        {activeTab === 'backup' && (
          <div className="space-y-4">
            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <h4 className="font-bold text-sm mb-1" style={{ color: theme.textPrimary }}>
                Download Personal JSON Backup
              </h4>
              <p className="text-xs text-slate-400 mb-4">
                Exports your registered courses, timetable slots, attendance counts, and tasks into a portable backup file.
              </p>
              <button
                onClick={handleExportJSON}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download My Backup JSON
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
              <h4 className="font-bold text-sm mb-1" style={{ color: theme.textPrimary }}>
                Restore from Backup (JSON)
              </h4>
              <p className="text-xs text-slate-400 mb-3">
                Upload a previously saved `.json` file to restore your schedule.
              </p>
              
              <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md cursor-pointer">
                <Upload className="w-4 h-4" />
                Select Backup File
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </label>

              {importError && (
                <p className="text-xs font-medium text-rose-400 mt-2 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {importError}
                </p>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SQLITE SCHEMA */}
        {activeTab === 'database' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  SQLite Student Queries
                </span>
                <button
                  onClick={handleCopySQL}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 transition-colors"
                >
                  {copiedSQL ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedSQL ? 'Copied SQL!' : 'Copy SQL'}
                </button>
              </div>

              <p className="text-xs text-slate-400 mb-3">
                Your database tables are stored in your zero-config local file <code className="text-indigo-300">data/academiasync.db</code>.
              </p>

              <pre className="p-3 rounded-xl bg-black/50 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-48 scrollbar-thin">
                {sampleSQL}
              </pre>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
