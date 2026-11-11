import React, { useState } from 'react';
import { AcademicHoliday, StudentData } from '../types';
import { THEMES } from '../styles/themes';
import { 
  Palmtree, 
  Plus, 
  Trash2, 
  Calendar, 
  X, 
  Check, 
  AlertCircle,
  Sparkles,
  Info
} from 'lucide-react';

interface HolidayManagerModalProps {
  state: StudentData;
  onClose: () => void;
  onAddHoliday: (holiday: Omit<AcademicHoliday, 'id' | 'createdAt'>) => void;
  onDeleteHoliday: (holidayId: string) => void;
}

export function HolidayManagerModal({
  state,
  onClose,
  onAddHoliday,
  onDeleteHoliday,
}: HolidayManagerModalProps) {
  const theme = THEMES[state.theme] || THEMES['dark-slate'];
  const holidays = state.holidays || [];

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please provide a title for the holiday or recess.');
      return;
    }
    if (!startDate || !endDate) {
      setError('Please specify both start and end dates.');
      return;
    }
    if (endDate < startDate) {
      setError('End date cannot be prior to start date.');
      return;
    }

    onAddHoliday({
      title: title.trim(),
      startDate,
      endDate,
      isOffDay: true,
      notes: notes.trim() || undefined,
      semesterNumber: state.activeSemesterNumber || 1,
    });

    setTitle('');
    setNotes('');
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="w-full max-w-2xl rounded-3xl p-6 sm:p-8 border shadow-2xl relative my-8"
        style={{
          backgroundColor: theme.headerBg,
          borderColor: theme.cardBorder,
        }}
      >
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Palmtree className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              Institutional Holidays & Recess
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Define campus breaks, festivals, or preparation leave. AcademiaSync automatically mutes class alerts and marks days off.
            </p>
          </div>
        </div>

        {/* Add Holiday Form */}
        <form onSubmit={handleSubmit} className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Plus className="w-4 h-4" />
            <span>Add Holiday / Recess Period</span>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Title / Event
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Diwali Vacation, Mid-Semester Recess, Sports Fest"
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                End Date (Inclusive)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Library remains open 9am-5pm"
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-amber-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Save Break</span>
            </button>
          </div>
        </form>

        {/* Existing Holidays List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Configured Holidays ({holidays.length})
            </h3>
          </div>

          {holidays.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-white/10 text-center">
              <Palmtree className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-50" />
              <p className="text-xs text-slate-400">
                No institutional breaks added yet. Add public holidays or semester breaks to suppress class reminders.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {holidays.map((h) => {
                const isCurrent = todayStr >= h.startDate && todayStr <= h.endDate;
                const isPast = todayStr > h.endDate;

                return (
                  <div
                    key={h.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                      isCurrent
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-200'
                        : isPast
                        ? 'bg-white/[0.02] border-white/5 opacity-60'
                        : 'bg-white/5 border-white/10 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-xl shrink-0 ${isCurrent ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-400'}`}>
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate">
                            {h.title}
                          </h4>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950">
                              Active Today
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {h.startDate} → {h.endDate}
                          {h.notes && <span className="ml-2 italic text-slate-500">• {h.notes}</span>}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteHoliday(h.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                      title="Remove break"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info className="w-4 h-4 text-amber-400" />
            <span>Classes scheduled on these dates will show "Recess / Off Day" and alarms won't sound.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
