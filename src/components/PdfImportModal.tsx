import { useState, useRef, useMemo, useEffect } from 'react';
import { StudentData, Course, TimeSlot, UserAccount, DayOfWeek } from '../types';
import { THEMES } from '../styles/themes';
import { parseTimetablePdf, ParsedTimetableResult, ParsedTimeSlot } from '../utils/pdfTimetableParser';
import { formatTime12h, DAYS_ORDER, getSlotDurationMultiplier } from '../utils/timeUtils';
import {
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  Sparkles,
  Calendar,
  BookOpen,
  Users,
  Check,
  Loader2,
  AlertCircle,
  Clock,
  MapPin,
  UserCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PdfImportModalProps {
  user: UserAccount;
  state: StudentData;
  onClose: () => void;
  onApplyImport: (newCourses: Course[], newSlots: TimeSlot[], updatedUserMetadata?: Partial<UserAccount>) => void;
}

export function PdfImportModal({
  user,
  state,
  onClose,
  onApplyImport,
}: PdfImportModalProps) {
  const theme = THEMES[state.theme] || THEMES['dark-slate'];
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedTimetableResult | null>(null);

  // Group selection for lab sessions (default to '2' if present, otherwise 'All')
  const [selectedGroup, setSelectedGroup] = useState<string>('All');
  // Set of selected slot IDs
  const [selectedSlotIds, setSelectedSlotIds] = useState<Set<string>>(new Set());
  // Import mode
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [updateProfile, setUpdateProfile] = useState(true);

  // Mid-Semester Attendance Baseline per Course (Slot-frequency aware)
  const isMidSemester = Boolean(user.semesterStartDate && user.semesterStartDate < new Date().toISOString().split('T')[0]);
  const [courseBaselines, setCourseBaselines] = useState<Record<string, { held: number; attended: number }>>({});

  useEffect(() => {
    if (parsedData && isMidSemester) {
      const today = new Date();
      const start = new Date(user.semesterStartDate!);
      const elapsedWeeks = Math.max(1, Math.floor((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)));
      const basePct = user.initialAttendancePct ?? 85;

      const initial: Record<string, { held: number; attended: number }> = {};
      for (const c of parsedData.courses) {
        const slotsCount = parsedData.slots.filter(s => s.courseCode === c.code).length;
        const held = Math.max(8, (slotsCount > 0 ? slotsCount : 3) * elapsedWeeks);
        const attended = Math.round(held * (basePct / 100));
        initial[c.code] = { held, attended };
      }
      setCourseBaselines(initial);
    }
  }, [parsedData, isMidSemester, user.semesterStartDate, user.initialAttendancePct]);

  const overlappingSlots = useMemo(() => {
    if (!parsedData) return [];
    const overlaps: { day: DayOfWeek; time: string; slots: ParsedTimeSlot[] }[] = [];
    const byDayTime = new Map<string, ParsedTimeSlot[]>();
    parsedData.slots
      .filter((s) => selectedSlotIds.has(s.id))
      .forEach((s) => {
        const key = `${s.day}_${s.startTime}_${s.endTime}`;
        if (!byDayTime.has(key)) byDayTime.set(key, []);
        byDayTime.get(key)!.push(s);
      });
    byDayTime.forEach((slotList, key) => {
      if (slotList.length > 1) {
        const [day, startTime, endTime] = key.split('_');
        overlaps.push({ day: day as DayOfWeek, time: `${formatTime12h(startTime)} - ${formatTime12h(endTime)}`, slots: slotList });
      }
    });
    return overlaps;
  }, [parsedData, selectedSlotIds]);

  const handleProcessFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setParseError('Please upload a valid PDF timetable document (.pdf).');
      return;
    }

    setParseError(null);
    setIsParsing(true);

    try {
      const result = await parseTimetablePdf(file);
      if (result.courses.length === 0 && result.slots.length === 0) {
        throw new Error('No timetable grid or course entries could be detected in this PDF.');
      }

      setParsedData(result);

      // Default selected group
      const initialGroup = result.detectedGroups.includes('2')
        ? '2'
        : result.detectedGroups.includes('1')
        ? '1'
        : 'All';
      setSelectedGroup(initialGroup);

      // Filter slots for initial group
      const initialSlotIds = new Set<string>();
      for (const slot of result.slots) {
        if (initialGroup === 'All' || slot.group === 'All' || slot.group === '0' || slot.group === initialGroup) {
          initialSlotIds.add(slot.id);
        }
      }
      setSelectedSlotIds(initialSlotIds);
    } catch (err: any) {
      console.error('PDF parsing error:', err);
      setParseError(err.message || 'Failed to read and parse this PDF file. Please ensure it is an academic schedule.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleProcessFile(file);
  };

  const handleGroupChange = (group: string) => {
    setSelectedGroup(group);
    if (!parsedData) return;

    const newIds = new Set<string>();
    for (const slot of parsedData.slots) {
      if (group === 'All' || slot.group === 'All' || slot.group === '0' || slot.group === group) {
        newIds.add(slot.id);
      }
    }
    setSelectedSlotIds(newIds);
  };

  const toggleSlotSelection = (id: string) => {
    setSelectedSlotIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleImportSubmit = () => {
    if (!parsedData) return;

    // Build Course objects
    const courseMap = new Map<string, Course>();

    parsedData.courses.forEach((c) => {
      const courseId = `course_${c.code.toLowerCase()}_${Date.now()}`;
      const baseline = courseBaselines[c.code];
      courseMap.set(c.code, {
        id: courseId,
        code: c.code,
        name: c.name,
        color: c.color,
        credits: c.credits,
        professor: c.professor,
        defaultRoom: c.defaultRoom,
        totalClasses: 0,
        attendedClasses: 0,
        baselineClassesHeld: baseline ? baseline.held : undefined,
        baselineAttendedClasses: baseline ? baseline.attended : undefined,
        attendanceGoal: user.personalGoalAttendance || user.collegeMinAttendance || 75,
      });
    });

    // Build TimeSlot objects for all selected slots
    const finalSlots: TimeSlot[] = [];
    parsedData.slots
      .filter((s) => selectedSlotIds.has(s.id))
      .forEach((s) => {
        const course = courseMap.get(s.courseCode);
        if (!course) return;

        finalSlots.push({
          id: `slot_${s.day.toLowerCase()}_${s.startTime.replace(':', '')}_${s.courseCode}_${Math.random().toString(36).substring(2, 6)}`,
          courseId: course.id,
          day: s.day,
          startTime: s.startTime,
          endTime: s.endTime,
          room: s.room || course.defaultRoom,
          type: s.type,
          durationMultiplier: getSlotDurationMultiplier({ startTime: s.startTime, endTime: s.endTime }),
          batch: s.group && s.group !== 'All' && s.group !== '0' ? `Batch ${s.group}` : undefined,
        });
      });

    const coursesArray = Array.from(courseMap.values());

    const updatedProfile: Partial<UserAccount> = {};
    if (updateProfile && parsedData.studentMetadata) {
      if (parsedData.studentMetadata.section) {
        updatedProfile.branch = parsedData.studentMetadata.section;
      }
      if (parsedData.studentMetadata.vid) {
        updatedProfile.rollNumber = parsedData.studentMetadata.vid;
      }
    }

    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 },
    });

    onApplyImport(coursesArray, finalSlots, updatedProfile);
    onClose();
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

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-white shadow-lg"
            style={{ backgroundColor: theme.accent }}
          >
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black" style={{ color: theme.textPrimary }}>
              Timetable PDF Scanner
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Upload your official university timetable PDF to automatically populate all courses, weekly slots & rooms.
            </p>
          </div>
        </div>

        {/* STEP 1: Upload Dropzone (When no data parsed yet) */}
        {!parsedData && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-10 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
                  : 'border-white/15 hover:border-white/30 bg-white/5 hover:bg-white/[0.07]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />

              {isParsing ? (
                <div className="py-6 flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                  <p className="text-sm font-bold text-white">Analyzing & Parsing Timetable PDF...</p>
                  <p className="text-xs text-slate-400">Extracting course catalog, faculty names, room numbers & weekly matrix</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Drop your timetable PDF here, or click to browse</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Supports Lovely Professional University (LPU), standard university ERP portals, and weekly matrix schedules.
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-white/10 text-[11px] font-mono text-slate-300 mt-2">
                    Accepts .PDF files • 100% private & client-side processed
                  </span>
                </div>
              )}
            </div>

            {parseError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{parseError}</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Preview & Confirmation (When parsed) */}
        {parsedData && (
          <div className="space-y-6">
            {/* Header Metadata Chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[10px] uppercase font-bold text-slate-400">Student VID / ID</p>
                <p className="text-sm font-mono font-bold text-white mt-0.5">
                  {parsedData.studentMetadata.vid || 'Detected'}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[10px] uppercase font-bold text-slate-400">Section</p>
                <p className="text-sm font-mono font-bold text-indigo-400 mt-0.5">
                  {parsedData.studentMetadata.section || 'General'}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[10px] uppercase font-bold text-slate-400">Subjects Found</p>
                <p className="text-sm font-bold text-emerald-400 mt-0.5">
                  {parsedData.courses.length} Courses
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                <p className="text-[10px] uppercase font-bold text-slate-400">Slots Selected</p>
                <p className="text-sm font-bold text-sky-400 mt-0.5">
                  {selectedSlotIds.size} of {parsedData.slots.length}
                </p>
              </div>
            </div>

            {/* Group Selector for Lab/Practical batches */}
            {parsedData.detectedGroups.length > 0 && (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    Select Your Lab / Practical Batch Group
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Lectures are shared across all groups. Select your assigned lab group (e.g. Group 2) to filter out other groups' practicals.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => handleGroupChange('All')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      selectedGroup === 'All' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All Groups
                  </button>
                  {parsedData.detectedGroups
                    .filter((g) => g !== 'All' && g !== '0')
                    .map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => handleGroupChange(g)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                          selectedGroup === g ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Group {g}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Courses Overview Badges */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                Detected Courses ({parsedData.courses.length})
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {parsedData.courses.map((c) => {
                  const b = courseBaselines[c.code];
                  const curPct = b && b.held > 0 ? Math.round((b.attended / b.held) * 1000) / 10 : 100;
                  return (
                    <div
                      key={c.code}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <div className="truncate">
                          <span className="font-mono font-bold text-xs text-white">{c.code}</span>
                          <span className="text-[11px] text-slate-300 ml-1.5 truncate">{c.name}</span>
                          <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-white/10 text-slate-300 ml-1.5">
                            {c.credits} cr
                          </span>
                        </div>
                      </div>

                      {isMidSemester && (
                        <div className="flex items-center gap-2 shrink-0 text-xs">
                          <span className="text-[10px] text-slate-400">Held:</span>
                          <input
                            type="number"
                            min="0"
                            max="200"
                            value={b?.held ?? 0}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                              setCourseBaselines((prev) => ({
                                ...prev,
                                [c.code]: {
                                  held: val,
                                  attended: Math.min(val, prev[c.code]?.attended ?? 0),
                                },
                              }));
                            }}
                            className="w-14 px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-white font-mono text-center text-xs focus:outline-none"
                          />
                          <span className="text-[10px] text-slate-400">Attd:</span>
                          <input
                            type="number"
                            min="0"
                            max={b?.held ?? 200}
                            value={b?.attended ?? 0}
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                              setCourseBaselines((prev) => ({
                                ...prev,
                                [c.code]: {
                                  held: prev[c.code]?.held ?? 0,
                                  attended: Math.min(prev[c.code]?.held ?? 0, val),
                                },
                              }));
                            }}
                            className="w-14 px-1.5 py-0.5 rounded bg-black/40 border border-white/10 text-white font-mono text-center text-xs focus:outline-none"
                          />
                          <span className="text-[11px] font-mono font-bold text-amber-400 w-12 text-right">
                            {curPct}%
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Elective Basket Conflict Resolver */}
            {overlappingSlots.length > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Parallel Elective Tracks Detected ({overlappingSlots.length})</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Your university schedule has simultaneous elective sessions at the same hour. Pick your enrolled subject below to automatically deselect alternative electives:
                </p>
                <div className="space-y-2">
                  {overlappingSlots.map((ov, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-mono text-amber-200">
                        {ov.day} • {ov.time}
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {ov.slots.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSelectedSlotIds((prev) => {
                                const next = new Set(prev);
                                ov.slots.forEach((os) => {
                                  if (os.id !== s.id) next.delete(os.id);
                                });
                                next.add(s.id);
                                return next;
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                          >
                            Keep {s.courseCode} Only
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weekly Slots Preview List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  Weekly Schedule Slots ({selectedSlotIds.size} Active)
                </h4>
                <div className="text-[11px] text-slate-400">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSlotIds.size === parsedData.slots.length) {
                        setSelectedSlotIds(new Set());
                      } else {
                        setSelectedSlotIds(new Set(parsedData.slots.map((s) => s.id)));
                      }
                    }}
                    className="hover:text-indigo-400 underline font-medium"
                  >
                    {selectedSlotIds.size === parsedData.slots.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {DAYS_ORDER.map((day) => {
                  const daySlots = parsedData.slots.filter((s) => s.day === day);
                  if (daySlots.length === 0) return null;

                  return (
                    <div key={day} className="space-y-1">
                      <p className="text-[11px] font-bold text-indigo-300 px-1 pt-1">{day}</p>
                      {daySlots.map((slot) => {
                        const isChecked = selectedSlotIds.has(slot.id);
                        const course = parsedData.courses.find((c) => c.code === slot.courseCode);

                        return (
                          <div
                            key={slot.id}
                            onClick={() => toggleSlotSelection(slot.id)}
                            className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                              isChecked
                                ? 'bg-white/10 border-white/20'
                                : 'bg-white/2 border-white/5 opacity-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSlotSelection(slot.id)}
                                className="w-3.5 h-3.5 rounded text-indigo-500 focus:ring-0 cursor-pointer"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white"
                                    style={{ backgroundColor: course?.color || theme.accent }}
                                  >
                                    {slot.courseCode}
                                  </span>
                                  <span className="text-xs font-semibold text-white">
                                    {course?.name || slot.courseCode}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    • {slot.type} {slot.group !== 'All' ? `(G:${slot.group})` : ''}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 text-right shrink-0">
                              <span className="text-xs font-mono text-slate-300">
                                {formatTime12h(slot.startTime)} - {formatTime12h(slot.endTime)}
                              </span>
                              {slot.room && (
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400">
                                  {slot.room}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Profile sync toggle */}
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateProfile}
                  onChange={(e) => setUpdateProfile(e.target.checked)}
                  className="rounded text-indigo-500 focus:ring-0"
                />
                Update profile with detected VID ({parsedData.studentMetadata.vid || 'N/A'}) & Section ({parsedData.studentMetadata.section || 'N/A'})
              </label>

              <button
                type="button"
                onClick={() => {
                  setParsedData(null);
                  setSelectedSlotIds(new Set());
                }}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Upload Different File
              </button>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleImportSubmit}
                disabled={selectedSlotIds.size === 0}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: theme.accent,
                  boxShadow: `0 0 15px ${theme.accentGlow}`,
                }}
              >
                <Check className="w-4 h-4" />
                Populate Timetable ({selectedSlotIds.size} Classes)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
