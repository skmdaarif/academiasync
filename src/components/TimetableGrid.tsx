import { useState } from 'react';
import { 
  DayOfWeek, 
  TimeSlot, 
  StudentData, 
  AttendanceStatus,
  Course
} from '../types';
import { THEMES } from '../styles/themes';
import { DAYS_ORDER, getTodayDayName, formatTime12h, parseTimeToMinutes } from '../utils/timeUtils';
import { 
  Clock, 
  MapPin, 
  User, 
  Plus, 
  Trash2, 
  Edit3, 
  Grid, 
  List, 
  CheckCircle2, 
  XCircle, 
  Sparkles, 
  Search,
  BookOpen,
  X
} from 'lucide-react';

interface TimetableGridProps {
  state: StudentData;
  onOpenAddSlot: () => void;
  onOpenAddCourse: () => void;
  onEditSlot: (slot: TimeSlot) => void;
  onDeleteSlot: (slotId: string) => void;
  onUpdateCourse?: (course: Course) => void;
  onDeleteCourse?: (courseId: string) => void;
  onMarkAttendance: (courseId: string, status: AttendanceStatus) => void;
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

export function TimetableGrid({
  state,
  onOpenAddSlot,
  onOpenAddCourse,
  onEditSlot,
  onDeleteSlot,
  onUpdateCourse,
  onDeleteCourse,
  onMarkAttendance,
}: TimetableGridProps) {
  const todayName = getTodayDayName();
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayName);
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const theme = THEMES[state.theme] || THEMES['dark-slate'];
  const courseMap = new Map(state.courses.map((c) => [c.id, c]));

  if (state.courses.length === 0) {
    return (
      <div 
        className="rounded-3xl p-10 text-center border shadow-xl"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
        }}
      >
        <BookOpen className="w-12 h-12 text-amber-400 mx-auto mb-3 opacity-80" />
        <h3 className="text-lg font-bold" style={{ color: theme.textPrimary }}>
          No Courses Registered Yet
        </h3>
        <p className="text-xs sm:text-sm max-w-sm mx-auto mt-1" style={{ color: theme.textSecondary }}>
          You need to register at least one subject before scheduling your weekly class timetable slots.
        </p>
        <button
          onClick={onOpenAddCourse}
          className="mt-5 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md hover:scale-105 transition-all"
          style={{ backgroundColor: theme.accent }}
        >
          <Plus className="w-4 h-4 inline mr-1" />
          Register Your First Course
        </button>
      </div>
    );
  }

  // Filter slots for selected day or all
  const filteredSlots = state.timeSlots.filter((slot) => {
    if (viewMode === 'daily' && slot.day !== selectedDay) return false;
    if (filterType !== 'all' && slot.type !== filterType) return false;
    if (searchQuery.trim()) {
      const course = courseMap.get(slot.courseId);
      const query = searchQuery.toLowerCase();
      const matchCourse = course && (course.name.toLowerCase().includes(query) || course.code.toLowerCase().includes(query));
      const matchRoom = slot.room?.toLowerCase().includes(query);
      const matchProf = course?.professor?.toLowerCase().includes(query);
      return matchCourse || matchRoom || matchProf;
    }
    return true;
  });

  const sortedDailySlots = [...filteredSlots].sort(
    (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
  );

  return (
    <div className="space-y-6">
      
      {/* Top Controls Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-3xl border"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
        }}
      >
        {/* Left: View Switcher & Search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center p-1 rounded-2xl bg-white/5 border border-white/5">
            <button
              onClick={() => setViewMode('daily')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                viewMode === 'daily' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              style={{
                backgroundColor: viewMode === 'daily' ? theme.accent : 'transparent',
              }}
            >
              <List className="w-3.5 h-3.5" />
              Daily View
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                viewMode === 'weekly' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              style={{
                backgroundColor: viewMode === 'weekly' ? theme.accent : 'transparent',
              }}
            >
              <Grid className="w-3.5 h-3.5" />
              Weekly Matrix
            </button>
          </div>

          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search course, room, prof..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-400 focus:outline-none focus:border-indigo-400"
            />
          </div>
        </div>

        {/* Right: Slot Type Filter & Add Class Button */}
        <div className="flex items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-white focus:outline-none"
          >
            <option value="all" className="bg-slate-900">All Slot Types</option>
            <option value="Lecture" className="bg-slate-900">Lectures</option>
            <option value="Lab" className="bg-slate-900">Labs & Practicals</option>
            <option value="Tutorial" className="bg-slate-900">Tutorials</option>
            <option value="Seminar" className="bg-slate-900">Seminars</option>
            <option value="Club / Activity" className="bg-slate-900">Clubs / Activities</option>
          </select>

          <button
            onClick={onOpenAddCourse}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 border border-white/10 hover:text-white hover:bg-white/10 transition-colors"
            title="Register New Subject"
          >
            <BookOpen className="w-3.5 h-3.5" />
            + Subject
          </button>

          <button
            onClick={onOpenAddSlot}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white shadow-md transition-all hover:scale-105"
            style={{
              backgroundColor: theme.accent,
              boxShadow: `0 0 10px ${theme.accentGlow}`,
            }}
          >
            <Plus className="w-4 h-4" />
            Add Class
          </button>
        </div>
      </div>

      {/* Quick Subject Chip Bar with Edit & Delete options */}
      {state.courses.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap uppercase tracking-wider flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            Subjects:
          </span>
          {state.courses.map((course) => (
            <div
              key={course.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all group shrink-0"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: course.color }}
              />
              <span className="font-mono font-bold text-white text-[11px]">{course.code}</span>
              <span className="text-slate-300 truncate max-w-[120px] text-[11px]">{course.name}</span>

              <button
                type="button"
                onClick={() => setEditingCourse({ ...course })}
                className="text-slate-400 hover:text-white p-0.5 rounded opacity-70 group-hover:opacity-100 transition-opacity ml-1"
                title="Edit Course Details"
              >
                <Edit3 className="w-3 h-3" />
              </button>

              {onDeleteCourse && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete course ${course.code} (${course.name}) and all its timetable class slots?`)) {
                      onDeleteCourse(course.id);
                    }
                  }}
                  className="text-slate-500 hover:text-rose-400 p-0.5 rounded opacity-70 group-hover:opacity-100 transition-opacity"
                  title="Delete Course"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Day Selector Tabs (For Daily Mode) */}
      {viewMode === 'daily' && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {DAYS_ORDER.map((day) => {
            const isSelected = selectedDay === day;
            const isToday = todayName === day;
            const daySlotCount = state.timeSlots.filter((s) => s.day === day).length;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`flex-1 min-w-[105px] py-3 px-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1 ${
                  isSelected
                    ? 'shadow-lg ring-2 ring-indigo-500/50'
                    : 'hover:bg-white/5 opacity-80'
                }`}
                style={{
                  backgroundColor: isSelected ? theme.headerBg : theme.cardBg,
                  borderColor: isSelected ? theme.accent : theme.cardBorder,
                }}
              >
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : ''}`} style={{ color: isSelected ? '#ffffff' : theme.textPrimary }}>
                    {day.slice(0, 3)}
                  </span>
                  {isToday && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" title="Today" />
                  )}
                </div>
                <span className="text-[11px] font-medium" style={{ color: theme.textSecondary }}>
                  {daySlotCount} {daySlotCount === 1 ? 'class' : 'classes'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* DAILY VIEW: Timeline Cards */}
      {viewMode === 'daily' && (
        <div className="space-y-4">
          {sortedDailySlots.length > 0 ? (
            sortedDailySlots.map((slot) => {
              const course = courseMap.get(slot.courseId);
              if (!course) return null;

              return (
                <div
                  key={slot.id}
                  className="rounded-3xl p-5 border shadow-md transition-all hover:translate-y-[-2px] flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden"
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: theme.cardBorder,
                  }}
                >
                  {/* Left Color Accent Bar */}
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-2"
                    style={{ backgroundColor: course.color }}
                  />

                  {/* Class Info */}
                  <div className="pl-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span 
                        className="px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold text-white shadow-sm"
                        style={{ backgroundColor: course.color }}
                      >
                        {course.code}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-white/10 text-slate-300">
                        {slot.type}
                      </span>
                      {slot.notes && (
                        <span className="text-[11px] text-amber-300 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-500/20">
                          📌 {slot.notes}
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-bold" style={{ color: theme.textPrimary }}>
                      {course.name}
                    </h3>

                    {/* Meta Row: Time, Room, Professor */}
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-medium" style={{ color: theme.textSecondary }}>
                      <span className="flex items-center gap-1.5 font-mono text-indigo-400">
                        <Clock className="w-4 h-4" />
                        {formatTime12h(slot.startTime)} - {formatTime12h(slot.endTime)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-rose-400" />
                        {slot.room || course.defaultRoom || 'Room TBA'}
                      </span>
                      {course.professor && (
                        <span className="flex items-center gap-1.5">
                          <User className="w-4 h-4 text-sky-400" />
                          {course.professor}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-2 pl-2 md:pl-0 border-t md:border-t-0 pt-3 md:pt-0 border-white/5">
                    {/* Quick Attendance */}
                    <button
                      onClick={() => onMarkAttendance(course.id, 'present')}
                      className="p-2 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/60 transition-all flex items-center gap-1"
                      title="Log Present"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Present</span>
                    </button>

                    <button
                      onClick={() => onMarkAttendance(course.id, 'absent')}
                      className="p-2 rounded-xl text-xs font-semibold text-rose-400 bg-rose-950/40 border border-rose-500/30 hover:bg-rose-900/60 transition-all flex items-center gap-1"
                      title="Log Absent / Bunk"
                    >
                      <XCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Missed</span>
                    </button>

                    {/* Edit & Delete */}
                    <button
                      onClick={() => onEditSlot(slot)}
                      className="p-2 rounded-xl border transition-colors hover:bg-white/10"
                      style={{ borderColor: theme.cardBorder, color: theme.textSecondary }}
                      title="Edit slot"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => onDeleteSlot(slot.id)}
                      className="p-2 rounded-xl border border-rose-500/20 text-rose-400 hover:bg-rose-950/30 transition-colors"
                      title="Delete slot"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div 
              className="rounded-3xl p-10 text-center border"
              style={{
                backgroundColor: theme.cardBg,
                borderColor: theme.cardBorder,
              }}
            >
              <Sparkles className="w-10 h-10 text-indigo-400 mx-auto mb-3 opacity-70" />
              <h3 className="text-base font-bold" style={{ color: theme.textPrimary }}>
                No classes scheduled for {selectedDay}
              </h3>
              <p className="text-xs mt-1 max-w-sm mx-auto" style={{ color: theme.textSecondary }}>
                Click below to add a class period to your {selectedDay} timetable.
              </p>
              <button
                onClick={onOpenAddSlot}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-transform hover:scale-105"
                style={{ backgroundColor: theme.accent }}
              >
                + Add Class to {selectedDay}
              </button>
            </div>
          )}
        </div>
      )}

      {/* WEEKLY MATRIX VIEW */}
      {viewMode === 'weekly' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {DAYS_ORDER.filter((d) => d !== 'Sunday' || state.timeSlots.some((s) => s.day === 'Sunday')).map((day) => {
            const daySlots = state.timeSlots
              .filter((s) => s.day === day)
              .sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
            const isToday = todayName === day;

            return (
              <div
                key={day}
                className={`rounded-3xl p-5 border flex flex-col justify-between shadow-lg ${
                  isToday ? 'ring-2 ring-indigo-500/40' : ''
                }`}
                style={{
                  backgroundColor: theme.cardBg,
                  borderColor: isToday ? theme.accent : theme.cardBorder,
                }}
              >
                <div>
                  {/* Day Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b"
                    style={{ borderColor: theme.cardBorder }}
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-sm" style={{ color: theme.textPrimary }}>
                        {day}
                      </h4>
                      {isToday && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          TODAY
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium" style={{ color: theme.textSecondary }}>
                      {daySlots.length} items
                    </span>
                  </div>

                  {/* Day Slots List */}
                  <div className="space-y-2.5">
                    {daySlots.length > 0 ? (
                      daySlots.map((slot) => {
                        const course = courseMap.get(slot.courseId);
                        if (!course) return null;

                        return (
                          <div
                            key={slot.id}
                            className="p-3 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all text-left group relative"
                          >
                            <div className="flex items-center justify-between">
                              <span 
                                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md text-white"
                                style={{ backgroundColor: course.color }}
                              >
                                {course.code}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {formatTime12h(slot.startTime)}
                              </span>
                            </div>

                            <p className="text-xs font-bold mt-1.5 line-clamp-1" style={{ color: theme.textPrimary }}>
                              {course.name}
                            </p>

                            <div className="flex items-center justify-between mt-2 text-[10px]" style={{ color: theme.textSecondary }}>
                              <span>📍 {slot.room || course.defaultRoom || 'TBA'}</span>
                              <span className="font-medium text-slate-300">{slot.type}</span>
                            </div>

                            {/* Hover Edit/Delete shortcut */}
                            <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-white/10">
                              <button
                                onClick={() => onEditSlot(slot)}
                                className="p-1 hover:text-indigo-400 text-slate-400"
                                title="Edit"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => onDeleteSlot(slot.id)}
                                className="p-1 hover:text-rose-400 text-slate-400"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs italic py-4 text-center text-slate-500">
                        No scheduled classes
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedDay(day);
                    onOpenAddSlot();
                  }}
                  className="mt-4 w-full py-1.5 rounded-xl text-[11px] font-semibold border border-dashed border-white/15 text-slate-400 hover:text-white hover:border-white/30 transition-all"
                >
                  + Add to {day.slice(0, 3)}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Course Modal */}
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
                  Edit Subject: {editingCourse.code}
                </h3>
                <p className="text-xs text-slate-400">
                  Update name, professor, classroom location, or theme color.
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onUpdateCourse && editingCourse) {
                  onUpdateCourse(editingCourse);
                }
                setEditingCourse(null);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Subject Code *
                  </label>
                  <input
                    type="text"
                    value={editingCourse.code}
                    onChange={(e) => setEditingCourse({ ...editingCourse, code: e.target.value.toUpperCase() })}
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-mono uppercase focus:outline-none"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Subject Name *
                  </label>
                  <input
                    type="text"
                    value={editingCourse.name}
                    onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
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
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
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
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Color options */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Badge & Accent Color
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Credits
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editingCourse.credits || 3}
                    onChange={(e) => setEditingCourse({ ...editingCourse, credits: parseInt(e.target.value, 10) || 3 })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Target Attendance (%)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={editingCourse.attendanceGoal || 75}
                    onChange={(e) => setEditingCourse({ ...editingCourse, attendanceGoal: parseInt(e.target.value, 10) || 75 })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                {onDeleteCourse && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete course ${editingCourse.code} (${editingCourse.name}) and all its scheduled class slots?`)) {
                        onDeleteCourse(editingCourse.id);
                        setEditingCourse(null);
                      }
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-rose-950/30 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Subject
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
