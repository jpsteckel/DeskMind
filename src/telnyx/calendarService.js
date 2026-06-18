import fetch from 'node-fetch';

/**
 * Fetch upcoming events from the user's primary Google Calendar for the next 30 days.
 * Expects `calendarTokens` to be an object with an `accessToken` property.
 * Returns an array of formatted strings like "2026-06-20 14:00 - Meeting title".
 */
export async function getNextMonthBookings(calendarTokens) {
  if (!calendarTokens || !calendarTokens.accessToken) return [];

  const accessToken = calendarTokens.accessToken;
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });

  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'GET',
    });

    if (res.status === 401) {
      console.warn('[calendarService] Access token unauthorized (401).');
      return [];
    }

    if (!res.ok) {
      const body = await res.text();
      console.warn('[calendarService] Failed to fetch events:', res.status, body);
      return [];
    }

    const data = await res.json();
    const items = data.items || [];

    const formatted = items.map((ev) => {
      const start = ev.start?.dateTime || ev.start?.date || null;
      const title = ev.summary || '(no title)';
      if (!start) return null;
      // Normalize date/time for display
      const dt = new Date(start);
      if (isNaN(dt.getTime())) return null;
      const date = dt.toISOString().replace('T', ' ').replace(/:\d{2}\.\d{3}Z$/, '');
      return `${date} - ${title}`;
    }).filter(Boolean);

    return formatted;
  } catch (err) {
    console.warn('[calendarService] Error fetching calendar events:', err?.message || err);
    return [];
  }
}
