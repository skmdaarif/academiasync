import { TimeSlot, Course, Task, Exam } from '../types';

/**
 * Generates an iCalendar (.ics) string for recurring weekly class timetable
 */
export function generateTimetableICS(slots: TimeSlot[], courses: Course[], semesterEndDate?: string): string {
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  const dayToICalDay: Record<string, string> = {
    Monday: 'MO',
    Tuesday: 'TU',
    Wednesday: 'WE',
    Thursday: 'TH',
    Friday: 'FR',
    Saturday: 'SA',
    Sunday: 'SU',
  };

  // Compute UNTIL date for semester boundary (default: 16 weeks from today)
  let untilDate: Date;
  if (semesterEndDate) {
    const [y, m, d] = semesterEndDate.split('-').map(Number);
    untilDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 59));
  } else {
    untilDate = new Date(Date.now() + 16 * 7 * 24 * 60 * 60 * 1000);
  }
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  const untilStr = `${untilDate.getUTCFullYear()}${pad(untilDate.getUTCMonth() + 1)}${pad(untilDate.getUTCDate())}T235959Z`;

  // Find next occurrence of a day of week starting from today
  const getNextDateForDay = (dayName: string): Date => {
    const dayMap: Record<string, number> = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };
    const targetDay = dayMap[dayName] ?? 1;
    const now = new Date();
    const currentDay = now.getDay();
    let distance = targetDay - currentDay;
    if (distance < 0) distance += 7;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + distance);
    return targetDate;
  };

  const formatICSDate = (date: Date, timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date(date);
    d.setHours(hours || 0, minutes || 0, 0, 0);
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AcademiaSync//College Timetable Generator//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:College Class Timetable',
  ];

  slots.forEach((slot) => {
    const course = courseMap.get(slot.courseId);
    if (!course) return;

    const baseDate = getNextDateForDay(slot.day);
    const dtStart = formatICSDate(baseDate, slot.startTime);
    const dtEnd = formatICSDate(baseDate, slot.endTime);
    const icalDay = dayToICalDay[slot.day] || 'MO';

    const summary = `${course.code}: ${course.name} (${slot.type})`;
    const location = slot.room || course.defaultRoom || 'Classroom';
    const description = `Professor: ${course.professor || 'N/A'}\\nType: ${slot.type}${slot.notes ? '\\nNotes: ' + slot.notes : ''}`;

    ics.push('BEGIN:VEVENT');
    ics.push(`UID:slot-${slot.id}-${Date.now()}@academiasync.local`);
    ics.push(`DTSTAMP:${formatICSDate(new Date(), '00:00')}`);
    ics.push(`DTSTART:${dtStart}`);
    ics.push(`DTEND:${dtEnd}`);
    ics.push(`RRULE:FREQ=WEEKLY;BYDAY=${icalDay};UNTIL=${untilStr}`);
    ics.push(`SUMMARY:${summary}`);
    ics.push(`LOCATION:${location}`);
    ics.push(`DESCRIPTION:${description}`);
    ics.push('STATUS:CONFIRMED');
    ics.push('END:VEVENT');
  });

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

/**
 * Downloads a file to the user's computer
 */
export function downloadFile(content: string, filename: string, type: string = 'text/calendar;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports tasks as an ICS file
 */
export function generateTasksICS(tasks: Task[], courses: Course[]): string {
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AcademiaSync//Student Tasks & Deadlines//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Academic Tasks & Deadlines',
  ];

  tasks.forEach((task) => {
    const course = task.courseId ? courseMap.get(task.courseId) : null;
    const dueTime = task.dueTime || '23:59';
    const [y, m, d] = task.dueDate.split('-').map(Number);
    const [hh, mm] = dueTime.split(':').map(Number);

    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    const dtString = `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;

    ics.push('BEGIN:VEVENT');
    ics.push(`UID:task-${task.id}@academiasync.local`);
    ics.push(`DTSTAMP:${dtString}Z`);
    ics.push(`DTSTART:${dtString}`);
    ics.push(`DTEND:${dtString}`);
    ics.push(`SUMMARY:[${task.category.toUpperCase()}] ${task.title}${course ? ` (${course.code})` : ''}`);
    ics.push(`DESCRIPTION:${task.description || ''}\\nPriority: ${task.priority.toUpperCase()}`);
    ics.push('END:VEVENT');
  });

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

/**
 * Exports University Examinations & Vivas as an ICS calendar file with alarm notifications
 */
export function generateExamsICS(exams: Exam[], courses: Course[]): string {
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AcademiaSync//University Exams & Vivas//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:University Examinations & Vivas',
  ];

  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);

  exams.forEach((exam) => {
    const course = exam.courseId ? courseMap.get(exam.courseId) : null;
    const startTime = exam.startTime || '09:00';
    const endTime = exam.endTime || '12:00';
    const [y, m, d] = exam.examDate.split('-').map(Number);
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);

    const dtStart = `${y}${pad(m)}${pad(d)}T${pad(sh)}${pad(sm)}00`;
    const dtEnd = `${y}${pad(m)}${pad(d)}T${pad(eh)}${pad(em)}00`;

    const unitsSummary = (exam.syllabusUnits || []).map((u) => `- ${u.title}`).join('\\n');
    const descParts = [
      `Category: ${exam.examCategory.toUpperCase()} (${exam.examType.toUpperCase()})`,
      course ? `Course: ${course.name} (${course.code})` : '',
      exam.maxMarks ? `Max Marks: ${exam.maxMarks}` : '',
      unitsSummary ? `Syllabus Units:\\n${unitsSummary}` : '',
      exam.notes ? `Notes: ${exam.notes}` : '',
    ].filter(Boolean);

    ics.push('BEGIN:VEVENT');
    ics.push(`UID:exam-${exam.id}@academiasync.local`);
    ics.push(`DTSTAMP:${dtStart}Z`);
    ics.push(`DTSTART:${dtStart}`);
    ics.push(`DTEND:${dtEnd}`);
    ics.push(`SUMMARY:[${exam.examCategory.toUpperCase()}] ${exam.title}${course ? ` (${course.code})` : ''}`);
    ics.push(`DESCRIPTION:${descParts.join('\\n')}`);
    if (exam.roomOrLab) {
      ics.push(`LOCATION:${exam.roomOrLab}`);
    }

    // 24-Hour Prior Reminder Alarm
    ics.push('BEGIN:VALARM');
    ics.push('ACTION:DISPLAY');
    ics.push(`DESCRIPTION:Upcoming Exam Tomorrow: ${exam.title}`);
    ics.push('TRIGGER:-P1D');
    ics.push('END:VALARM');

    // 2-Hour Prior Reminder Alarm
    ics.push('BEGIN:VALARM');
    ics.push('ACTION:DISPLAY');
    ics.push(`DESCRIPTION:Exam in 2 Hours: ${exam.title} (${exam.roomOrLab || 'Room TBA'})`);
    ics.push('TRIGGER:-PT2H');
    ics.push('END:VALARM');

    ics.push('END:VEVENT');
  });

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}
