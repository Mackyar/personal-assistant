import * as ics from 'ics';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const key = searchParams.get('key');

  if (!url || !key) {
    return new NextResponse('Missing url or key', { status: 400 });
  }

  // Prevent SSRF: Ensure the URL is a valid Supabase project URL
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/i.test(url)) {
    return new NextResponse('Invalid Supabase URL format', { status: 400 });
  }

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('sync_state')
      .select('data')
      .eq('id', 'user_1')
      .single();

    if (error || !data || !data.data) {
      return new NextResponse('Could not fetch calendar data. Make sure you have synced your data at least once.', { status: 500 });
    }

    const state = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
    const eventsData = state.events || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const icsEvents: ics.EventAttributes[] = eventsData.map((ev: any) => {
      const dateParts = ev.date.split('-').map(Number); // [YYYY, MM, DD]
      
      let start: ics.DateArray = [dateParts[0], dateParts[1], dateParts[2]];
      let end: ics.DateArray = [dateParts[0], dateParts[1], dateParts[2]];
      
      if (!ev.allDay && ev.startTime) {
        const startParts = ev.startTime.split(':').map(Number);
        start = [dateParts[0], dateParts[1], dateParts[2], startParts[0], startParts[1]];
        
        if (ev.endTime) {
          const endParts = ev.endTime.split(':').map(Number);
          end = [dateParts[0], dateParts[1], dateParts[2], endParts[0], endParts[1]];
        } else {
          // If no end time, default to 1 hour later
          let endHour = startParts[0] + 1;
          if (endHour > 23) endHour = 23;
          end = [dateParts[0], dateParts[1], dateParts[2], endHour, startParts[1]];
        }
      }

      return {
        title: ev.title,
        start,
        end,
        location: ev.location,
        description: ev.notes,
        uid: ev.id,
      };
    });

    if (icsEvents.length === 0) {
        // Return a dummy empty calendar if no events exist yet
        return new NextResponse(
            `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Personal Assistant//EN\r\nEND:VCALENDAR`, 
            {
              headers: {
                'Content-Type': 'text/calendar; charset=utf-8',
                'Content-Disposition': 'attachment; filename="calendar.ics"',
              },
            }
          );
    }

    return new Promise<NextResponse>((resolve) => {
      ics.createEvents(icsEvents, (error, value) => {
        if (error) {
          console.error(error);
          resolve(new NextResponse('Error generating calendar', { status: 500 }));
          return;
        }
        resolve(new NextResponse(value, {
          headers: {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': 'attachment; filename="calendar.ics"',
          },
        }));
      });
    });

  } catch (err) {
    console.error(err);
    return new NextResponse('Internal error', { status: 500 });
  }
}
