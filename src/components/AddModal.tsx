import React, { useState } from 'react';
import { 
  StudentData, 
  Course, 
  TimeSlot, 
  Task, 
  DayOfWeek, 
  SlotType, 
  TaskPriority, 
  TaskCategory 
} from '../types';
import { THEMES } from '../styles/themes';
import { DAYS_ORDER, checkSlotOverlap, parseTimeToMinutes } from '../utils/timeUtils';
import { X, Plus, Calendar, CheckSquare, BookOpen, Trash2, AlertCircle } from 'lucide-react';

interface AddModalProps {
  type: 'slot' | 'task' | 'course';
  state: StudentData;
  defaultTargetAttendance?: number;
  initialSlot?: TimeSlot | null;
  onClose: () => void;
  onAddSlot: (slot: Omit<TimeSlot, 'id' | 'userId'>) => void;
  onUpdateSlot?: (slot: TimeSlot) => void;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'userId'>) => void;
  onAddCourse: (course: Omit<Course, 'id' | 'userId'>) => void;
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

export function AddModal({
  type,
  state,
  defaultTargetAttendance,
  initialSlot,
  onClose,
  onAddSlot,
  onUpdateSlot,
  onAddTask,
  onAddCourse,
}: AddModalProps) {
  const theme = THEMES[state.theme] || THEMES['dark-slate'];

  // Slot Form State
  const [slotCourseId, setSlotCourseId] = useState<string>(initialSlot?.courseId || state.courses[0]?.id || '');
  const [slotDay, setSlotDay] = useState<DayOfWeek>(initialSlot?.day || 'Monday');
  const [slotStartTime, setSlotStartTime] = useState(initialSlot?.startTime || '09:00');
  const [slotEndTime, setSlotEndTime] = useState(initialSlot?.endTime || '10:00');
  const [slotRoom, setSlotRoom] = useState(initialSlot?.room || '');
  const [slotType, setSlotType] = useState<SlotType>(initialSlot?.type || 'Lecture');
  const [slotNotes, setSlotNotes] = useState(initialSlot?.notes || '');
  const [slotError, setSlotError] = useState<string>('');

  // Task Form State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskCourseId, setTaskCourseId] = useState<string>(state.courses[0]?.id || '');
  const [taskDueDate, setTaskDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [taskDueTime, setTaskDueTime] = useState('23:59');
  const [taskPriority, setTaskPriority] = useState<TaskPriority>('medium');
  const [taskCategory, setTaskCategory] = useState<TaskCategory>('assignment');
  const [subtaskInputs, setSubtaskInputs] = useState<string[]>(['']);

  // Course Form State
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [courseProf, setCourseProf] = useState('');
  const [courseRoom, setCourseRoom] = useState('');
  const [courseColor, setCourseColor] = useState(PRESET_COLORS[0]);
  const [courseCredits, setCourseCredits] = useState(3);
  const [courseTarget, setCourseTarget] = useState(defaultTargetAttendance || 75);
  const [isMidSemester, setIsMidSemester] = useState(false);
  const [pastTotalClasses, setPastTotalClasses] = useState(0);
  const [pastAttendedClasses, setPastAttendedClasses] = useState(0);

  const handleSlotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSlotError('');
    if (!slotCourseId) {
      setSlotError('Please select a course.');
      return;
    }

    const startM = parseTimeToMinutes(slotStartTime);
    const endM = parseTimeToMinutes(slotEndTime);
    if (endM <= startM) {
      setSlotError('End time must be after start time.');
      return;
    }

    const conflict = checkSlotOverlap(state.timeSlots, {
      day: slotDay,
      startTime: slotStartTime,
      endTime: slotEndTime,
      id: initialSlot?.id,
    });

    if (conflict) {
      const conflictCourse = state.courses.find((c) => c.id === conflict.courseId);
      const courseName = conflictCourse ? conflictCourse.code : 'another class';
      setSlotError(`Schedule conflict! This slot overlaps with ${courseName} (${conflict.startTime} - ${conflict.endTime}) on ${slotDay}.`);
      return;
    }

    if (initialSlot && onUpdateSlot) {
      onUpdateSlot({
        ...initialSlot,
        courseId: slotCourseId,
        day: slotDay,
        startTime: slotStartTime,
        endTime: slotEndTime,
        room: slotRoom.trim() || undefined,
        type: slotType,
        notes: slotNotes.trim() || undefined,
      });
    } else {
      onAddSlot({
        courseId: slotCourseId,
        day: slotDay,
        startTime: slotStartTime,
        endTime: slotEndTime,
        room: slotRoom.trim() || undefined,
        type: slotType,
        notes: slotNotes.trim() || undefined,
      });
    }
    onClose();
  };

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const validSubtasks = subtaskInputs
      .filter((s) => s.trim().length > 0)
      .map((s, idx) => ({
        id: `st-${Date.now()}-${idx}`,
        title: s.trim(),
        completed: false,
      }));

    onAddTask({
      title: taskTitle.trim(),
      description: taskDesc.trim() || undefined,
      courseId: taskCourseId || undefined,
      dueDate: taskDueDate,
      dueTime: taskDueTime,
      priority: taskPriority,
      status: 'todo',
      category: taskCategory,
      subtasks: validSubtasks.length > 0 ? validSubtasks : undefined,
    });
    onClose();
  };

  const handleCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !courseName.trim()) return;

    const totalHeld = isMidSemester ? Math.max(0, pastTotalClasses) : 0;
    const attended = isMidSemester ? Math.min(totalHeld, Math.max(0, pastAttendedClasses)) : 0;

    onAddCourse({
      code: courseCode.trim().toUpperCase(),
      name: courseName.trim(),
      professor: courseProf.trim() || undefined,
      defaultRoom: courseRoom.trim() || undefined,
      color: courseColor,
      credits: courseCredits,
      attendanceGoal: courseTarget,
      totalClasses: totalHeld,
      attendedClasses: attended,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="w-full max-w-lg rounded-3xl p-6 sm:p-7 border shadow-2xl relative my-8"
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

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-md"
            style={{ backgroundColor: theme.accent }}
          >
            {type === 'slot' && <Calendar className="w-5 h-5" />}
            {type === 'task' && <CheckSquare className="w-5 h-5" />}
            {type === 'course' && <BookOpen className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: theme.textPrimary }}>
              {type === 'slot' && (initialSlot ? 'Edit Timetable Class Slot' : 'Add Timetable Class Slot')}
              {type === 'task' && 'Add Task, Assignment or Exam'}
              {type === 'course' && 'Register New College Course / Subject'}
            </h2>
            <p className="text-xs text-slate-400">
              {type === 'slot' && (initialSlot ? 'Modify this lecture, lab, or tutorial period.' : 'Schedule a recurring lecture, lab, or tutorial period.')}
              {type === 'task' && 'Track deliverables, upcoming tests, or study milestones.'}
              {type === 'course' && 'Register a new subject with attendance targets and color.'}
            </p>
          </div>
        </div>

        {/* SLOT FORM */}
        {type === 'slot' && (
          <form onSubmit={handleSlotSubmit} className="space-y-4">
            {slotError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{slotError}</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Select Course *
              </label>
              {state.courses.length > 0 ? (
                <select
                  value={slotCourseId}
                  onChange={(e) => setSlotCourseId(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-400"
                >
                  {state.courses.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900">
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-rose-400">
                  Please register a course first before creating class slots.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Day of Week *
                </label>
                <select
                  value={slotDay}
                  onChange={(e) => setSlotDay(e.target.value as DayOfWeek)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                >
                  {DAYS_ORDER.map((day) => (
                    <option key={day} value={day} className="bg-slate-900">
                      {day}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Slot Type
                </label>
                <select
                  value={slotType}
                  onChange={(e) => setSlotType(e.target.value as SlotType)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                >
                  <option value="Lecture" className="bg-slate-900">Lecture</option>
                  <option value="Lab" className="bg-slate-900">Lab / Practical</option>
                  <option value="Tutorial" className="bg-slate-900">Tutorial</option>
                  <option value="Seminar" className="bg-slate-900">Seminar</option>
                  <option value="Club / Activity" className="bg-slate-900">Club / Activity</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={slotStartTime}
                  onChange={(e) => setSlotStartTime(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  End Time *
                </label>
                <input
                  type="time"
                  value={slotEndTime}
                  onChange={(e) => setSlotEndTime(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Room / Hall (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Hall 302, Systems Lab 4"
                value={slotRoom}
                onChange={(e) => setSlotRoom(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Notes / Topic (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Bring lab journals, presentation day"
                value={slotNotes}
                onChange={(e) => setSlotNotes(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={state.courses.length === 0}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
                style={{ backgroundColor: theme.accent }}
              >
                {initialSlot ? 'Save Slot Changes' : 'Add Class Slot'}
              </button>
            </div>
          </form>
        )}

        {/* TASK FORM */}
        {type === 'task' && (
          <form onSubmit={handleTaskSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Task Title *
              </label>
              <input
                type="text"
                placeholder="e.g. Submit Operating Systems Lab Report 4"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Category
                </label>
                <select
                  value={taskCategory}
                  onChange={(e) => setTaskCategory(e.target.value as TaskCategory)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                >
                  <option value="assignment" className="bg-slate-900">Assignment</option>
                  <option value="exam" className="bg-slate-900">Exam / Midterm</option>
                  <option value="project" className="bg-slate-900">Term Project</option>
                  <option value="quiz" className="bg-slate-900">Quiz / Test</option>
                  <option value="reading" className="bg-slate-900">Reading / Notes</option>
                  <option value="personal" className="bg-slate-900">Personal / Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Priority
                </label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as TaskPriority)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                >
                  <option value="urgent" className="bg-slate-900">🔥 Urgent</option>
                  <option value="high" className="bg-slate-900">⚠️ High</option>
                  <option value="medium" className="bg-slate-900">Medium</option>
                  <option value="low" className="bg-slate-900">Low</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Linked Course
                </label>
                <select
                  value={taskCourseId}
                  onChange={(e) => setTaskCourseId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                >
                  <option value="" className="bg-slate-900">None (General)</option>
                  {state.courses.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900">
                      {c.code}: {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Due Date *
                </label>
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Description / Requirements (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Details, submission links, guidelines..."
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none resize-none"
              />
            </div>

            {/* Subtasks Checklist */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Subtask Checklist (Optional)
                </label>
                <button
                  type="button"
                  onClick={() => setSubtaskInputs([...subtaskInputs, ''])}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add item
                </button>
              </div>

              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {subtaskInputs.map((val, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Step ${i + 1}...`}
                      value={val}
                      onChange={(e) => {
                        const copy = [...subtaskInputs];
                        copy[i] = e.target.value;
                        setSubtaskInputs(copy);
                      }}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white focus:outline-none"
                    />
                    {subtaskInputs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSubtaskInputs(subtaskInputs.filter((_, idx) => idx !== i))}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-transform hover:scale-105"
                style={{ backgroundColor: theme.accent }}
              >
                Create Task
              </button>
            </div>
          </form>
        )}

        {/* COURSE FORM */}
        {type === 'course' && (
          <form onSubmit={handleCourseSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Code *
                </label>
                <input
                  type="text"
                  placeholder="e.g. CS601"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
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
                  placeholder="e.g. Cloud Computing & Systems"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
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
                  placeholder="e.g. Dr. Alan Turing"
                  value={courseProf}
                  onChange={(e) => setCourseProf(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Default Room
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lab 3, Hall 102"
                  value={courseRoom}
                  onChange={(e) => setCourseRoom(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Course Color Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Badge & Theme Color
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCourseColor(c)}
                    className={`w-7 h-7 rounded-xl transition-transform ${
                      courseColor === c ? 'scale-125 ring-2 ring-white shadow-lg' : 'hover:scale-110 opacity-80'
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
                  value={courseCredits}
                  onChange={(e) => setCourseCredits(parseInt(e.target.value, 10) || 3)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Attendance %
                </label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={courseTarget}
                  onChange={(e) => setCourseTarget(parseInt(e.target.value, 10) || 75)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Mid-Semester Previous Attendance Section */}
            <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isMidSemester}
                      onChange={(e) => setIsMidSemester(e.target.checked)}
                      className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
                    />
                    Starting Mid-Semester? (Enter Past Attendance)
                  </label>
                  <p className="text-[11px] text-slate-400 mt-0.5 ml-5">
                    If this course is already ongoing, enter previous classes held and attended.
                  </p>
                </div>
              </div>

              {isMidSemester && (
                <div className="pt-2 border-t border-white/10 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Total Classes Held So Far
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={pastTotalClasses || ''}
                        placeholder="e.g. 24"
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setPastTotalClasses(val);
                          if (pastAttendedClasses > val) {
                            setPastAttendedClasses(val);
                          }
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Classes You Attended
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={pastTotalClasses || 200}
                        value={pastAttendedClasses || ''}
                        placeholder="e.g. 21"
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 0;
                          setPastAttendedClasses(Math.min(pastTotalClasses, Math.max(0, val)));
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {pastTotalClasses > 0 && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-black/20 border border-white/5 text-xs">
                      <span className="text-slate-400">Starting Attendance Rate:</span>
                      <span className={`font-bold px-2 py-0.5 rounded-lg ${
                        ((pastAttendedClasses / pastTotalClasses) * 100) >= courseTarget 
                          ? 'bg-emerald-500/20 text-emerald-300' 
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {((pastAttendedClasses / pastTotalClasses) * 100).toFixed(1)}% ({pastAttendedClasses}/{pastTotalClasses})
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-transform hover:scale-105"
                style={{ backgroundColor: theme.accent }}
              >
                Register Course
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
