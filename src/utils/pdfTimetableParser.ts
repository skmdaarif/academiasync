import * as pdfjsLib from 'pdfjs-dist';
import { DayOfWeek, SlotType } from '../types';

// Configure PDF.js worker for client-side execution in Vite / Tauri / Browser
if (typeof window !== 'undefined' && 'Worker' in window) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

export function normalizeSlotType(raw: string): SlotType {
  if (/Practical/i.test(raw) || /Lab/i.test(raw)) return 'Lab';
  if (/Tutorial/i.test(raw)) return 'Tutorial';
  if (/Seminar/i.test(raw)) return 'Seminar';
  if (/Club/i.test(raw) || /Activity/i.test(raw)) return 'Club / Activity';
  return 'Lecture';
}

export interface ParsedCourse {
  code: string;
  name: string;
  type: string;
  credits: number;
  professor?: string;
  defaultRoom?: string;
  color: string;
}

export interface ParsedTimeSlot {
  id: string;
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  courseCode: string;
  type: SlotType;
  group: string;
  room: string;
  section?: string;
}

export interface ParsedTimetableResult {
  studentMetadata: {
    vid?: string;
    section?: string;
    printedOn?: string;
  };
  courses: ParsedCourse[];
  slots: ParsedTimeSlot[];
  detectedGroups: string[];
}

const PRESET_PALETTE = [
  '#6366f1', // Indigo
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#84cc16', // Lime
];

export function parseTimetableRange(rangeStr: string): { startTime: string; endTime: string } {
  const match = rangeStr.trim().match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return { startTime: '09:00', endTime: '10:00' };

  const [_, h1Str, m1Str, h2Str, m2Str, ampm] = match;
  let h1 = parseInt(h1Str, 10);
  let h2 = parseInt(h2Str, 10);
  const m1 = m1Str;
  const m2 = m2Str;

  const meridian = ampm ? ampm.toUpperCase() : (h1 >= 8 && h1 <= 11 ? 'AM' : 'PM');
  if (meridian === 'PM') {
    if (h1 < 12) h1 += 12;
    if (h2 < 12) h2 += 12;
  } else if (meridian === 'AM') {
    if (h1 === 12) h1 = 0;
    if (h2 === 12) h2 = 0;
  }
  if (h1 > h2) {
    if (h2 < 12) h2 += 12;
  }

  const format2 = (num: number) => num.toString().padStart(2, '0');
  return {
    startTime: `${format2(h1)}:${m1}`,
    endTime: `${format2(h2)}:${m2}`,
  };
}

interface PdfTextItem {
  str: string;
  x: number;
  y: number;
}

export async function parseTimetablePdf(fileOrBuffer: File | ArrayBuffer | Uint8Array): Promise<ParsedTimetableResult> {
  let arrayBuffer: ArrayBuffer;
  if (fileOrBuffer instanceof File) {
    arrayBuffer = await fileOrBuffer.arrayBuffer();
  } else if (fileOrBuffer instanceof Uint8Array) {
    const copy = new Uint8Array(fileOrBuffer.byteLength);
    copy.set(fileOrBuffer);
    arrayBuffer = copy.buffer;
  } else {
    arrayBuffer = fileOrBuffer;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  let vid: string | undefined;
  let section: string | undefined;
  let printedOn: string | undefined;

  const courseCatalogMap = new Map<string, {
    name: string;
    type: string;
    credits: number;
    professor?: string;
  }>();

  // Page 2 or subsequent pages: Course Catalog Table ("My Course")
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const items: PdfTextItem[] = content.items
      .map((it: any) => ({
        str: it.str?.trim() || '',
        x: Math.round(it.transform?.[4] || 0),
        y: Math.round(it.transform?.[5] || 0),
      }))
      .filter((it) => it.str.length > 0);

    const fullPageText = items.map((i) => i.str).join(' ');

    if (!vid) {
      const vidMatch = fullPageText.match(/VID\s*:\s*(\w+)/i);
      if (vidMatch) vid = vidMatch[1];
    }
    if (!section) {
      const sectionMatch = fullPageText.match(/Home Section\s*:?\s*([A-Z0-9]+)/i);
      if (sectionMatch && sectionMatch[1] !== 'Printed') {
        section = sectionMatch[1];
      }
    }
    if (!printedOn) {
      const printedMatch = fullPageText.match(/Printed On\s+([0-9\/\:\sAPMapm]+)/i);
      if (printedMatch) printedOn = printedMatch[1].trim();
    }

    // Identify courses on this page
    // Look for course codes at X in [80, 115]
    const codeItems = items.filter((it) => it.x >= 80 && it.x <= 115 && /^[A-Z]{2,4}\d{3,4}$/.test(it.str));
    for (const cItem of codeItems) {
      const code = cItem.str;
      // All items on this table row (within vertical window Y +/- 10)
      const rowItems = items
        .filter((it) => Math.abs(it.y - cItem.y) <= 10)
        .sort((a, b) => a.x - b.x);

      // Course Type is at X in [160, 200]
      const typeItem = rowItems.find((it) => it.x >= 155 && it.x <= 200);
      const courseType = typeItem ? typeItem.str : 'CR';

      // Course Title items are at X in [200, 345]
      const titleItems = rowItems.filter((it) => it.x >= 200 && it.x <= 345);
      const courseTitle = titleItems.map((it) => it.str).join(' ') || code;

      // Credit items: lectures (~350), tutorial (~390), practical (~433), credits (~477)
      const creditItem = rowItems.find((it) => it.x >= 460 && it.x <= 495 && /^\d+$/.test(it.str));
      const credits = creditItem ? parseInt(creditItem.str, 10) : 3;

      // Faculty name is at X in [500, 600]
      const facultyItems = rowItems.filter((it) => 
        it.x >= 500 && 
        it.x <= 600 && 
        !it.str.includes('Last Updated') && 
        !/^\d{4}/.test(it.str) &&
        !/\d{1,2}:\d{2}/.test(it.str) &&
        it.str !== 'NA'
      );
      let facultyName = facultyItems.map((it) => it.str).join(' ').trim();
      if (facultyName) {
        // Strip timestamps, dates, and cabin brackets e.g. "Kavita Devi ( 34-202-CH24 )" -> "Kavita Devi"
        facultyName = facultyName
          .replace(/\d{1,2}\s+\d{4}.*$/i, '')
          .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+.*$/i, '')
          .replace(/\s*\(.*?\)/g, '')
          .split(',')[0]
          .trim();
      }

      if (!courseCatalogMap.has(code)) {
        courseCatalogMap.set(code, {
          name: courseTitle,
          type: courseType,
          credits,
          professor: facultyName || undefined,
        });
      }
    }
  }

  // Page 1: Weekly Timetable Grid
  const slots: ParsedTimeSlot[] = [];
  const groupSet = new Set<string>();

  const page1 = await pdfDoc.getPage(1);
  const tc1 = await page1.getTextContent();
  const items1: PdfTextItem[] = tc1.items
    .map((it: any) => ({
      str: it.str?.trim() || '',
      x: Math.round(it.transform?.[4] || 0),
      y: Math.round(it.transform?.[5] || 0),
    }))
    .filter((it) => it.str.length > 0);

  // Identify timing items at X < 140
  const timingItems = items1
    .filter((i) => i.x < 140 && /\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/i.test(i.str))
    .sort((a, b) => b.y - a.y);

  // Day columns (X boundaries calibrated from standard timetable grid)
  const dayColumns: Array<{ day: DayOfWeek; minX: number; maxX: number }> = [
    { day: 'Monday', minX: 140, maxX: 210 },
    { day: 'Tuesday', minX: 210, maxX: 290 },
    { day: 'Wednesday', minX: 290, maxX: 370 },
    { day: 'Thursday', minX: 370, maxX: 450 },
    { day: 'Friday', minX: 450, maxX: 530 },
    { day: 'Saturday', minX: 530, maxX: 610 },
    { day: 'Sunday', minX: 610, maxX: 700 },
  ];

  for (let tIdx = 0; tIdx < timingItems.length; tIdx++) {
    const tItem = timingItems[tIdx];
    const { startTime, endTime } = parseTimetableRange(tItem.str);

    // Bounding Y range for this time period row
    const topY = tItem.y + 10;
    const bottomY = tIdx + 1 < timingItems.length ? (tItem.y + timingItems[tIdx + 1].y) / 2 : tItem.y - 30;

    for (const col of dayColumns) {
      const cellItems = items1
        .filter((i) => i.x >= col.minX && i.x < col.maxX && i.y <= topY && i.y > bottomY)
        .sort((a, b) => b.y - a.y || a.x - b.x);

      if (cellItems.length === 0) continue;
      const cellText = cellItems.map((i) => i.str).join(' ');

      // Ignore placeholder Saturday text
      if (cellText.includes('Project Work') || cellText.includes('Check Schedule')) continue;

      const typeMatch = cellText.match(/(Lecture|Practical|Tutorial|Seminar)/i);
      const groupMatch = cellText.match(/G\s*:\s*(\w+)/i);
      const courseMatch = cellText.match(/C\s*:\s*([A-Z]{2,4}\d{3,4})/i);
      const roomMatch = cellText.match(/R\s*:\s*([\w\s\-]+?)(?=\s*\/|\s*S:|$)/i);
      const secMatch = cellText.match(/S\s*:\s*(\w+)/i);

      if (courseMatch) {
        const courseCode = courseMatch[1];
        const group = groupMatch ? groupMatch[1] : 'All';
        const rawRoom = roomMatch ? roomMatch[1].replace(/\s+/g, '').trim() : '';
        const slotType = normalizeSlotType(typeMatch ? typeMatch[1] : 'Lecture');

        groupSet.add(group);

        slots.push({
          id: `scanned_${col.day.toLowerCase()}_${startTime.replace(':', '')}_${courseCode}`,
          day: col.day,
          startTime,
          endTime,
          courseCode,
          type: slotType,
          group,
          room: rawRoom,
          section: secMatch ? secMatch[1] : section,
        });

        // If course wasn't listed on Page 2, add placeholder
        if (!courseCatalogMap.has(courseCode)) {
          courseCatalogMap.set(courseCode, {
            name: courseCode,
            type: 'CR',
            credits: 3,
          });
        }
      }
    }
  }

  if ((!section || section === 'Printed') && slots.length > 0) {
    const foundSec = slots.find((s) => s.section && s.section !== 'Printed')?.section;
    if (foundSec) section = foundSec;
  }

  // Assemble finalized Course list with assigned theme colors and default rooms
  const finalCourses: ParsedCourse[] = [];
  let colorIdx = 0;

  for (const [code, info] of courseCatalogMap.entries()) {
    // Find most common room from slots
    const courseSlots = slots.filter((s) => s.courseCode === code && s.room);
    const roomCounts = new Map<string, number>();
    for (const s of courseSlots) {
      roomCounts.set(s.room, (roomCounts.get(s.room) || 0) + 1);
    }
    let defaultRoom = '';
    let maxRoomCount = 0;
    for (const [r, count] of roomCounts.entries()) {
      if (count > maxRoomCount) {
        defaultRoom = r;
        maxRoomCount = count;
      }
    }

    finalCourses.push({
      code,
      name: info.name,
      type: info.type,
      credits: info.credits,
      professor: info.professor,
      defaultRoom: defaultRoom || undefined,
      color: PRESET_PALETTE[colorIdx % PRESET_PALETTE.length],
    });
    colorIdx++;
  }

  return {
    studentMetadata: {
      vid,
      section,
      printedOn,
    },
    courses: finalCourses,
    slots,
    detectedGroups: Array.from(groupSet).sort(),
  };
}
