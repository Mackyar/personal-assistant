import Papa from 'papaparse';
import { CalendarEvent } from '../db/schema';

export interface ParsedClass {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location: string;
  color: string;
}

export function extractSections(csvText: string): string[] {
  const result = Papa.parse(csvText, { skipEmptyLines: true });
  const rows = result.data as string[][];
  const sections = new Set<string>();

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    if (row.length > 1 && row[1]) {
      const sectionInfo = row[1].trim();
      const match = sectionInfo.match(/^(S[1-9])/i);
      if (match) {
        sections.add(match[1].toUpperCase());
      }
    }
  }

  return Array.from(sections).sort();
}

function parseTime(timeStr: string): string | null {
  // e.g. "9.30 AM" -> "09:30"
  timeStr = timeStr.trim();
  const match = timeStr.match(/(\d{1,2})\.(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hours = parseInt(match[1]);
  const mins = match[2];
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, '0')}:${mins}`;
}

export function parseTimetable(csvText: string, targetSection: string): ParsedClass[] {
  const result = Papa.parse(csvText, { skipEmptyLines: true });
  const rows = result.data as string[][];
  
  if (rows.length < 3) return [];

  const headers = rows[1]; // Index 1 is the header row
  const events: ParsedClass[] = [];
  let currentDate = '';

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    
    // Update date if column 0 is present
    if (row[0] && row[0].trim() !== '') {
      try {
        // new Date("09 July 2026") parses as LOCAL midnight (00:00 IST = July 8 18:30 UTC).
        // getUTCDate() would return 8 (wrong). We must use LOCAL date methods instead.
        const dateParsed = new Date(row[0].trim());
        if (!isNaN(dateParsed.getTime())) {
          const y = dateParsed.getFullYear();
          const m = String(dateParsed.getMonth() + 1).padStart(2, '0');
          const d = String(dateParsed.getDate()).padStart(2, '0');
          currentDate = `${y}-${m}-${d}`;
        }
      } catch {
        // keep previous currentDate if parsing fails
      }
    }

    if (!currentDate) continue;

    // Check section
    if (row[1] && row[1].trim() !== '') {
      const sectionInfo = row[1].trim();
      
      if (sectionInfo.toUpperCase().startsWith(targetSection.toUpperCase())) {
        // Extract room name (usually after newline)
        let room = '';
        const lines = sectionInfo.split('\n');
        if (lines.length > 1) {
          room = lines.slice(1).join(' ').trim();
        }

        // Parse classes for this section
        for (let col = 2; col < headers.length; col++) {
          if (!headers[col]) continue;
          
          const classTitle = row[col]?.trim();
          if (!classTitle) continue;

          // Extract times from header e.g., "9.30 AM - 11.00 AM"
          const timeRange = headers[col].split('-');
          let startTime = '09:00';
          let endTime = '10:00';
          
          if (timeRange.length === 2) {
            const parsedStart = parseTime(timeRange[0]);
            const parsedEnd = parseTime(timeRange[1]);
            if (parsedStart) startTime = parsedStart;
            if (parsedEnd) endTime = parsedEnd;
          }

          // Sometimes times are overridden inside the cell (e.g. "(7.15-9.15 PM)")
          // Let's strip those for the title but we won't get too complex here.
          
          events.push({
            id: crypto.randomUUID(),
            title: classTitle,
            date: currentDate,
            startTime,
            endTime,
            location: room,
            color: '#8b5cf6', // Violet color for timetable classes
          });
        }
      }
    }
  }

  return events;
}
