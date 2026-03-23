import { google } from 'googleapis';

function getCalendarClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback'
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

function parseDate(dateString: string): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dateString === 'today') {
    return today;
  }

  if (dateString === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  if (dateString.match(/^next\s+monday$/i)) {
    const nextMonday = new Date(today);
    nextMonday.setDate(nextMonday.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));
    return nextMonday;
  }

  return new Date(dateString);
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  attendees?: string[];
  location?: string;
  description?: string;
}

export async function checkCalendar(date: string): Promise<CalendarEvent[]> {
  try {
    const calendar = getCalendarClient();
    const parsedDate = parseDate(date);

    const startOfDay = new Date(parsedDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(parsedDate);
    endOfDay.setHours(23, 59, 59, 999);

    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events: CalendarEvent[] = [];

    if (res.data.items) {
      for (const event of res.data.items) {
        events.push({
          id: event.id || '',
          title: event.summary || '(no title)',
          start: event.start?.dateTime || event.start?.date || '',
          end: event.end?.dateTime || event.end?.date || '',
          attendees: event.attendees?.map((a) => a.email || '') || [],
          location: event.location ?? undefined,
          description: event.description ?? undefined,
        });
      }
    }

    return events;
  } catch (err) {
    console.error('Calendar check error:', err);
    throw err;
  }
}

export async function createCalendarEvent(
  title: string,
  date: string,
  time: string,
  durationMinutes: number = 30,
  attendees?: string[]
): Promise<{ id: string; message: string }> {
  try {
    const calendar = getCalendarClient();
    const parsedDate = parseDate(date);

    const [hours, minutes] = time.split(':').map(Number);
    const startTime = new Date(parsedDate);
    startTime.setHours(hours, minutes, 0, 0);

    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + durationMinutes);

    const eventBody: any = {
      summary: title,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Europe/London',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Europe/London',
      },
    };

    if (attendees && attendees.length > 0) {
      eventBody.attendees = attendees.map((email) => ({ email }));
    }

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventBody,
    });

    return {
      id: res.data.id || '',
      message: `Event "${title}" created for ${date} at ${time} (${durationMinutes} mins)`,
    };
  } catch (err) {
    console.error('Calendar create event error:', err);
    throw err;
  }
}

export async function updateCalendarEvent(
  eventId: string,
  updates: Partial<CalendarEvent>
): Promise<{ id: string; message: string }> {
  try {
    const calendar = getCalendarClient();

    const event = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    });

    if (!event.data) {
      throw new Error(`Event ${eventId} not found`);
    }

    const updateBody: any = {
      summary: updates.title || event.data.summary,
      description: updates.description || event.data.description,
    };

    if (updates.location) {
      updateBody.location = updates.location;
    }

    const res = await calendar.events.update({
      calendarId: 'primary',
      eventId,
      requestBody: updateBody,
    });

    return {
      id: res.data.id || '',
      message: `Event updated`,
    };
  } catch (err) {
    console.error('Calendar update event error:', err);
    throw err;
  }
}
