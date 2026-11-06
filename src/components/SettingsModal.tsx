import { useState } from 'react';
import { StudentData, UserAccount, Course } from '../types';
import { THEMES } from '../styles/themes';
import { X, User, BookOpen, Trash2, Check, RotateCcw, Edit3 } from 'lucide-react';

interface SettingsModalProps {
  user: UserAccount;
  state: StudentData;
  onClose: () => void;
  onUpdateUser: (user: UserAccount) => void;
  onUpdateCourse?: (course: Course) => void;
  onDeleteCourse: (courseId: string) => void;
  onClearAllData: () => void;
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

export function SettingsModal({
  user,
  state,
  onClose,
  onUpdateUser,
  onUpdateCourse,
  onDeleteCourse,
  onClearAllData,
}: SettingsModalProps) {
  const theme = THEMES[state.theme] || THEMES['dark-slate'];

  const [formData, setFormData] = useState<UserAccount>({ ...user });
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateUser(formData);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to erase all your courses, schedule slots, and tasks to start fresh? This cannot be undone.')) {
      onClearAllData();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="w-full max-w-xl rounded-3xl p-6 sm:p-8 border shadow-2xl relative my-8"
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
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: theme.textPrimary }}>
              Profile & Academic Settings
            </h2>
            <p className="text-xs text-slate-400">
              Update your student profile, academic semester, and course listings.
            </p>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Student Full Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                College / University Name
              </label>
              <input
                type="text"
                value={formData.collegeName}
                onChange={(e) => setFormData({ ...formData, collegeName: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Branch / Major
              </label>
              <input
                type="text"
                value={formData.branch}
                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Semester / Year
              </label>
              <input
                type="text"
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Semester Start Date
              </label>
              <input
                type="date"
                value={formData.semesterStartDate ? formData.semesterStartDate.split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, semesterStartDate: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                College Min Requirement (%)
              </label>
              <input
                type="number"
                min="50"
                max="100"
                value={formData.collegeMinAttendance || 75}
                onChange={(e) => {
                  const collegeVal = parseInt(e.target.value, 10) || 75;
                  setFormData({
                    ...formData,
                    collegeMinAttendance: collegeVal,
                    // Auto-adjust personal goal if it would fall below college minimum
                    personalGoalAttendance: Math.max(collegeVal, formData.personalGoalAttendance || collegeVal),
                  });
                }}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Personal Attendance Goal (%)
              </label>
              <input
                type="number"
                min={formData.collegeMinAttendance || 75}
                max="100"
                value={formData.personalGoalAttendance || formData.collegeMinAttendance || 75}
                onChange={(e) => {
                  const goalVal = parseInt(e.target.value, 10) || (formData.collegeMinAttendance || 75);
                  setFormData({
                    ...formData,
                    personalGoalAttendance: goalVal,
                    targetAttendance: goalVal,
                  });
                }}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
              />
              <span className="text-[10px] text-amber-400/80 mt-0.5 block">
                Must be ≥ {formData.collegeMinAttendance || 75}% (Defaults to College Min)
              </span>
            </div>
          </div>

          {/* Courses List */}
          <div className="pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Registered Courses ({state.courses.length})
            </h4>

            {state.courses.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {state.courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: course.color }}
                      />
                      <span className="font-mono font-bold text-white">{course.code}</span>
                      <span className="text-slate-300 truncate max-w-[180px]">{course.name}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingCourse({ ...course })}
                        className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
                        title="Edit Course Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete course ${course.code} and its scheduled slots?`)) {
                            onDeleteCourse(course.id);
                          }
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/30 transition-colors"
                        title="Delete Course"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic py-2">
                No courses added yet.
              </p>
            )}
          </div>

          {/* Footer controls */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={handleClearData}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-rose-950/30 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Wipe Data & Reset Blank
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md flex items-center gap-1.5"
                style={{ backgroundColor: theme.accent }}
              >
                {savedSuccess ? <Check className="w-4 h-4" /> : null}
                {savedSuccess ? 'Saved!' : 'Save Settings'}
              </button>
            </div>
          </div>
        </form>

      </div>

      {/* Course Edit Submodal */}
      {editingCourse && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div 
            className="w-full max-w-md rounded-3xl p-6 border shadow-2xl relative"
            style={{
              backgroundColor: theme.headerBg,
              borderColor: theme.cardBorder,
            }}
          >
            <button
              onClick={() => setEditingCourse(null)}
              className="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-white bg-white/5"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: theme.textPrimary }}>
              <Edit3 className="w-4 h-4 text-indigo-400" />
              Edit Course Details: {editingCourse.code}
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onUpdateCourse && editingCourse) {
                  onUpdateCourse(editingCourse);
                }
                setEditingCourse(null);
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Code</label>
                  <input
                    type="text"
                    value={editingCourse.code}
                    onChange={(e) => setEditingCourse({ ...editingCourse, code: e.target.value.toUpperCase() })}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono uppercase focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Subject Name</label>
                  <input
                    type="text"
                    value={editingCourse.name}
                    onChange={(e) => setEditingCourse({ ...editingCourse, name: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Professor</label>
                  <input
                    type="text"
                    value={editingCourse.professor || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, professor: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Default Room</label>
                  <input
                    type="text"
                    value={editingCourse.defaultRoom || ''}
                    onChange={(e) => setEditingCourse({ ...editingCourse, defaultRoom: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Badge Color</label>
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Credits</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editingCourse.credits || 3}
                    onChange={(e) => setEditingCourse({ ...editingCourse, credits: parseInt(e.target.value, 10) || 3 })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Target Attendance %</label>
                  <input
                    type="number"
                    min={formData.collegeMinAttendance || 75}
                    max="100"
                    value={editingCourse.attendanceGoal || formData.collegeMinAttendance || 75}
                    onChange={(e) => setEditingCourse({ ...editingCourse, attendanceGoal: parseInt(e.target.value, 10) || (formData.collegeMinAttendance || 75) })}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
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
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
