import React, { useState } from 'react';
import { 
  Task, 
  TaskPriority, 
  TaskStatus, 
  TaskCategory, 
  Course, 
  StudentData 
} from '../types';
import { THEMES } from '../styles/themes';
import { 
  CheckSquare, 
  Clock, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Layers, 
  Check,
  Edit3,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TaskManagerProps {
  state: StudentData;
  onAddTask: (task: Omit<Task, 'id' | 'createdAt' | 'userId'>) => void;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenAddModal: () => void;
}

export function TaskManager({
  state,
  onUpdateTask,
  onDeleteTask,
  onOpenAddModal,
}: TaskManagerProps) {
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const theme = THEMES[state.theme] || THEMES['dark-slate'];
  const courseMap = new Map(state.courses.map((c) => [c.id, c]));

  if (state.tasks.length === 0) {
    return (
      <div 
        className="rounded-3xl p-10 text-center border shadow-xl"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
        }}
      >
        <CheckSquare className="w-12 h-12 text-emerald-400 mx-auto mb-3 opacity-80" />
        <h3 className="text-lg font-bold" style={{ color: theme.textPrimary }}>
          Your Task Kanban is Fresh and Clean
        </h3>
        <p className="text-xs sm:text-sm max-w-sm mx-auto mt-1" style={{ color: theme.textSecondary }}>
          Organize upcoming assignments, lab reports, homework, and test preparation with checklists and deadlines.
        </p>
        <button
          onClick={onOpenAddModal}
          className="mt-5 px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md hover:scale-105 transition-all"
          style={{ backgroundColor: theme.accent }}
        >
          <Plus className="w-4 h-4 inline mr-1" />
          Add Your First Task
        </button>
      </div>
    );
  }

  // Filter tasks
  const filteredTasks = state.tasks.filter((task) => {
    if (filterCourse !== 'all' && task.courseId !== filterCourse) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (filterCategory !== 'all' && task.category !== filterCategory) return false;
    return true;
  });

  const handleStatusChange = (task: Task, newStatus: TaskStatus) => {
    if (newStatus === 'completed' && task.status !== 'completed') {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
    onUpdateTask({ ...task, status: newStatus });
  };

  const handleToggleSubtask = (task: Task, subtaskId: string) => {
    if (!task.subtasks) return;
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );

    const allDone = updatedSubtasks.every((st) => st.completed);
    if (allDone && task.status !== 'completed') {
      confetti({ particleCount: 30, spread: 50 });
    }

    onUpdateTask({
      ...task,
      subtasks: updatedSubtasks,
      status: allDone ? 'completed' : task.status,
    });
  };

  const handleSaveEditedTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editingTask.title.trim()) return;
    onUpdateTask({
      ...editingTask,
      title: editingTask.title.trim(),
      description: editingTask.description?.trim() || undefined,
    });
    setEditingTask(null);
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">🔥 Urgent</span>;
      case 'high':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">⚠️ High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">Medium</span>;
      case 'low':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-400 border border-slate-500/30">Low</span>;
    }
  };

  const getCategoryBadge = (category: TaskCategory) => {
    const map: Record<TaskCategory, { label: string; color: string }> = {
      assignment: { label: 'Assignment', color: 'bg-indigo-950/40 text-indigo-300 border-indigo-500/20' },
      exam: { label: 'Exam / Midterm', color: 'bg-rose-950/40 text-rose-300 border-rose-500/20' },
      project: { label: 'Term Project', color: 'bg-emerald-950/40 text-emerald-300 border-emerald-500/20' },
      quiz: { label: 'Quiz / Test', color: 'bg-amber-950/40 text-amber-300 border-amber-500/20' },
      reading: { label: 'Reading', color: 'bg-cyan-950/40 text-cyan-300 border-cyan-500/20' },
      personal: { label: 'Personal', color: 'bg-purple-950/40 text-purple-300 border-purple-500/20' },
    };
    const item = map[category] || map.assignment;
    return (
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${item.color}`}>
        {item.label}
      </span>
    );
  };

  const calculateDaysRemaining = (dueDate: string): { text: string; isOverdue: boolean } => {
    const [y, m, d] = dueDate.split('-').map(Number);
    const target = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
    const today = new Date().setHours(0, 0, 0, 0);
    const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
    if (diffDays === 0) return { text: 'Due Today', isOverdue: false };
    if (diffDays === 1) return { text: 'Due Tomorrow', isOverdue: false };
    return { text: `Due in ${diffDays} days`, isOverdue: false };
  };

  const todoTasks = filteredTasks.filter((t) => t.status === 'todo');
  const inProgressTasks = filteredTasks.filter((t) => t.status === 'in-progress');
  const completedTasks = filteredTasks.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-6">
      
      {/* Header & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-3xl border"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* View Toggle */}
          <div className="flex items-center p-1 rounded-2xl bg-white/5 border border-white/5">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                viewMode === 'kanban' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              style={{
                backgroundColor: viewMode === 'kanban' ? theme.accent : 'transparent',
              }}
            >
              <Layers className="w-3.5 h-3.5" />
              Kanban Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                viewMode === 'list' ? 'text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              style={{
                backgroundColor: viewMode === 'list' ? theme.accent : 'transparent',
              }}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              List View
            </button>
          </div>

          {/* Filter Course */}
          {state.courses.length > 0 && (
            <select
              value={filterCourse}
              onChange={(e) => setFilterCourse(e.target.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-white focus:outline-none"
            >
              <option value="all" className="bg-slate-900">All Subjects</option>
              {state.courses.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900">
                  {c.code}: {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Filter Priority */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-white focus:outline-none"
          >
            <option value="all" className="bg-slate-900">All Priorities</option>
            <option value="urgent" className="bg-slate-900">Urgent</option>
            <option value="high" className="bg-slate-900">High</option>
            <option value="medium" className="bg-slate-900">Medium</option>
            <option value="low" className="bg-slate-900">Low</option>
          </select>

          {/* Filter Category */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-white focus:outline-none"
          >
            <option value="all" className="bg-slate-900">All Categories</option>
            <option value="assignment" className="bg-slate-900">Assignments</option>
            <option value="exam" className="bg-slate-900">Exams / Tests</option>
            <option value="project" className="bg-slate-900">Projects</option>
            <option value="quiz" className="bg-slate-900">Quizzes</option>
            <option value="reading" className="bg-slate-900">Readings</option>
            <option value="personal" className="bg-slate-900">Personal</option>
          </select>
        </div>

        <button
          onClick={onOpenAddModal}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all hover:scale-105"
          style={{
            backgroundColor: theme.accent,
            boxShadow: `0 0 12px ${theme.accentGlow}`,
          }}
        >
          <Plus className="w-4 h-4" />
          Add Task / Assignment
        </button>
      </div>

      {/* KANBAN BOARD VIEW */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Column: To Do */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                <h3 className="font-extrabold text-sm" style={{ color: theme.textPrimary }}>
                  To Do
                </h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 font-mono font-bold text-slate-300">
                {todoTasks.length}
              </span>
            </div>

            <div className="space-y-3">
              {todoTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  theme={theme}
                  courseMap={courseMap}
                  onStatusChange={handleStatusChange}
                  onToggleSubtask={handleToggleSubtask}
                  onEdit={(t) => setEditingTask({ ...t })}
                  onDelete={onDeleteTask}
                  getPriorityBadge={getPriorityBadge}
                  getCategoryBadge={getCategoryBadge}
                  calculateDaysRemaining={calculateDaysRemaining}
                />
              ))}
              {todoTasks.length === 0 && (
                <div className="p-6 rounded-3xl border border-dashed border-white/10 text-center text-xs text-slate-500">
                  No tasks to do
                </div>
              )}
            </div>
          </div>

          {/* Column: In Progress */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <h3 className="font-extrabold text-sm" style={{ color: theme.textPrimary }}>
                  In Progress
                </h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 font-mono font-bold text-amber-300">
                {inProgressTasks.length}
              </span>
            </div>

            <div className="space-y-3">
              {inProgressTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  theme={theme}
                  courseMap={courseMap}
                  onStatusChange={handleStatusChange}
                  onToggleSubtask={handleToggleSubtask}
                  onEdit={(t) => setEditingTask({ ...t })}
                  onDelete={onDeleteTask}
                  getPriorityBadge={getPriorityBadge}
                  getCategoryBadge={getCategoryBadge}
                  calculateDaysRemaining={calculateDaysRemaining}
                />
              ))}
              {inProgressTasks.length === 0 && (
                <div className="p-6 rounded-3xl border border-dashed border-white/10 text-center text-xs text-slate-500">
                  No tasks in progress
                </div>
              )}
            </div>
          </div>

          {/* Column: Completed */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <h3 className="font-extrabold text-sm" style={{ color: theme.textPrimary }}>
                  Completed
                </h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 font-mono font-bold text-emerald-300">
                {completedTasks.length}
              </span>
            </div>

            <div className="space-y-3">
              {completedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  theme={theme}
                  courseMap={courseMap}
                  onStatusChange={handleStatusChange}
                  onToggleSubtask={handleToggleSubtask}
                  onEdit={(t) => setEditingTask({ ...t })}
                  onDelete={onDeleteTask}
                  getPriorityBadge={getPriorityBadge}
                  getCategoryBadge={getCategoryBadge}
                  calculateDaysRemaining={calculateDaysRemaining}
                />
              ))}
              {completedTasks.length === 0 && (
                <div className="p-6 rounded-3xl border border-dashed border-white/10 text-center text-xs text-slate-500">
                  No completed tasks yet
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              theme={theme}
              courseMap={courseMap}
              onStatusChange={handleStatusChange}
              onToggleSubtask={handleToggleSubtask}
              onEdit={(t) => setEditingTask({ ...t })}
              onDelete={onDeleteTask}
              getPriorityBadge={getPriorityBadge}
              getCategoryBadge={getCategoryBadge}
              calculateDaysRemaining={calculateDaysRemaining}
            />
          ))}
        </div>
      )}

      {/* EDIT TASK MODAL */}
      {editingTask && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div 
            className="w-full max-w-lg rounded-3xl p-6 sm:p-7 border shadow-2xl relative my-8"
            style={{
              backgroundColor: theme.headerBg,
              borderColor: theme.cardBorder,
            }}
          >
            <button
              onClick={() => setEditingTask(null)}
              className="absolute right-5 top-5 p-2 rounded-xl text-slate-400 hover:text-white bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-md"
                style={{ backgroundColor: theme.accent }}
              >
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold" style={{ color: theme.textPrimary }}>
                  Edit Task Details
                </h2>
                <p className="text-xs text-slate-400">
                  Modify assignment deadlines, course link, priority or checklist.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveEditedTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={editingTask.category}
                    onChange={(e) => setEditingTask({ ...editingTask, category: e.target.value as TaskCategory })}
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
                    value={editingTask.priority}
                    onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value as TaskPriority })}
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
                    Status
                  </label>
                  <select
                    value={editingTask.status}
                    onChange={(e) => setEditingTask({ ...editingTask, status: e.target.value as TaskStatus })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  >
                    <option value="todo" className="bg-slate-900">To Do</option>
                    <option value="in-progress" className="bg-slate-900">In Progress</option>
                    <option value="completed" className="bg-slate-900">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Linked Course
                  </label>
                  <select
                    value={editingTask.courseId || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, courseId: e.target.value || undefined })}
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    value={editingTask.dueDate}
                    onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Due Time
                  </label>
                  <input
                    type="time"
                    value={editingTask.dueTime || '23:59'}
                    onChange={(e) => setEditingTask({ ...editingTask, dueTime: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={editingTask.description || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  placeholder="Task details..."
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none resize-none"
                />
              </div>

              {/* Subtask editing */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Subtask Checklist
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newSubtasks = [...(editingTask.subtasks || [])];
                      newSubtasks.push({
                        id: `st-${Date.now()}-${newSubtasks.length}`,
                        title: '',
                        completed: false,
                      });
                      setEditingTask({ ...editingTask, subtasks: newSubtasks });
                    }}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add item
                  </button>
                </div>

                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {editingTask.subtasks?.map((st, i) => (
                    <div key={st.id || i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={st.title}
                        placeholder={`Step ${i + 1}...`}
                        onChange={(e) => {
                          const updated = [...(editingTask.subtasks || [])];
                          updated[i] = { ...updated[i], title: e.target.value };
                          setEditingTask({ ...editingTask, subtasks: updated });
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const filtered = (editingTask.subtasks || []).filter((_, idx) => idx !== i);
                          setEditingTask({ ...editingTask, subtasks: filtered });
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete task "${editingTask.title}"?`)) {
                      onDeleteTask(editingTask.id);
                      setEditingTask(null);
                    }
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-rose-950/30"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Task
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
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

interface TaskCardProps {
  task: Task;
  theme: any;
  courseMap: Map<string, Course>;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onToggleSubtask: (task: Task, subtaskId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  getPriorityBadge: (p: TaskPriority) => React.ReactNode;
  getCategoryBadge: (c: TaskCategory) => React.ReactNode;
  calculateDaysRemaining: (date: string) => { text: string; isOverdue: boolean };
}

function TaskCard({
  task,
  theme,
  courseMap,
  onStatusChange,
  onToggleSubtask,
  onEdit,
  onDelete,
  getPriorityBadge,
  getCategoryBadge,
  calculateDaysRemaining,
}: TaskCardProps) {
  const course = task.courseId ? courseMap.get(task.courseId) : null;
  const daysInfo = calculateDaysRemaining(task.dueDate);
  const completedSubtasksCount = task.subtasks?.filter((s) => s.completed).length || 0;
  const totalSubtasksCount = task.subtasks?.length || 0;

  return (
    <div
      className="rounded-3xl p-5 border shadow-md transition-all hover:translate-y-[-2px] relative group text-left"
      style={{
        backgroundColor: theme.cardBg,
        borderColor: task.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : theme.cardBorder,
        opacity: task.status === 'completed' ? 0.85 : 1,
      }}
    >
      {/* Top badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {getCategoryBadge(task.category)}
          {getPriorityBadge(task.priority)}
        </div>
        
        {course && (
          <span 
            className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md text-white shadow-sm"
            style={{ backgroundColor: course.color }}
          >
            {course.code}
          </span>
        )}
      </div>

      {/* Title */}
      <h4 className={`font-bold text-sm ${task.status === 'completed' ? 'line-through text-slate-400' : ''}`}
        style={{ color: task.status === 'completed' ? '#94a3b8' : theme.textPrimary }}
      >
        {task.title}
      </h4>

      {/* Description */}
      {task.description && (
        <p className="text-xs mt-1.5 line-clamp-2" style={{ color: theme.textSecondary }}>
          {task.description}
        </p>
      )}

      {/* Subtasks checklist if present */}
      {totalSubtasksCount > 0 && (
        <div className="mt-3 pt-3 border-t space-y-1.5" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex justify-between text-[10px] font-semibold text-slate-400 mb-1">
            <span>Checklist</span>
            <span>{completedSubtasksCount}/{totalSubtasksCount} completed</span>
          </div>

          {task.subtasks!.map((st) => (
            <div
              key={st.id}
              onClick={() => onToggleSubtask(task, st.id)}
              className="flex items-center gap-2 text-xs cursor-pointer py-0.5 hover:text-white transition-colors"
            >
              <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                st.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-500 bg-white/5'
              }`}>
                {st.completed && <Check className="w-3 h-3" />}
              </div>
              <span className={`text-[11px] ${st.completed ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                {st.title}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bottom meta row: Due date & Status controls */}
      <div className="mt-4 pt-3 border-t flex items-center justify-between gap-2"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <span className={`text-[11px] font-medium flex items-center gap-1 ${
          daysInfo.isOverdue ? 'text-rose-400 font-bold' : 'text-slate-400'
        }`}>
          <Clock className="w-3.5 h-3.5" />
          {daysInfo.text}
        </span>

        {/* Status transition chips */}
        <div className="flex items-center gap-1.5">
          {task.status !== 'completed' && (
            <button
              onClick={() => onStatusChange(task, 'completed')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-300 bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/60 transition-colors flex items-center gap-1"
            >
              <CheckCircle2 className="w-3 h-3" />
              Done
            </button>
          )}

          {task.status === 'todo' && (
            <button
              onClick={() => onStatusChange(task, 'in-progress')}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-amber-300 bg-amber-950/40 border border-amber-500/30 hover:bg-amber-900/60 transition-colors"
            >
              Start
            </button>
          )}

          {task.status === 'completed' && (
            <button
              onClick={() => onStatusChange(task, 'todo')}
              className="px-2 py-1 rounded-lg text-[10px] text-slate-400 hover:text-white bg-white/5 transition-colors"
            >
              Reopen
            </button>
          )}

          <button
            onClick={() => onEdit(task)}
            className="p-1 rounded-lg text-slate-400 hover:text-white bg-white/5 transition-colors"
            title="Edit task details"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => onDelete(task.id)}
            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
            title="Delete task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
