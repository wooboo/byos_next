import assert from "node:assert/strict";
import test from "node:test";
import { fetchCalendarEvents } from "../lib/calendar/ics.ts";

const ICAL_FEED = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BYOS//Tests//EN
X-WR-CALNAME:Team Calendar
BEGIN:VEVENT
UID:event-1
DTSTAMP:20260101T000000Z
DTSTART:20260110T100000Z
DTEND:20260110T110000Z
SUMMARY:Planning
LOCATION:Room 1
END:VEVENT
END:VCALENDAR`;

test("fetchCalendarEvents parses matching ICS events", async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response(ICAL_FEED);

	try {
		const events = await fetchCalendarEvents(
			"https://calendar.example/feed.ics",
			new Date("2026-01-10T00:00:00Z"),
			new Date("2026-01-11T00:00:00Z"),
		);

		assert.equal(events.length, 1);
		assert.equal(events[0].summary, "Planning");
		assert.equal(events[0].location, "Room 1");
		assert.equal(events[0].calendarName, "Team Calendar");
		assert.equal(events[0].start.toISOString(), "2026-01-10T10:00:00.000Z");
		assert.equal(events[0].end.toISOString(), "2026-01-10T11:00:00.000Z");
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("fetchCalendarEvents normalizes Nextcloud public calendar links", async () => {
	const originalFetch = globalThis.fetch;
	const requestedUrls: string[] = [];
	globalThis.fetch = async (input) => {
		requestedUrls.push(String(input));
		return new Response(ICAL_FEED);
	};

	try {
		await fetchCalendarEvents(
			"https://cloud.example/apps/calendar/p/public-token/shared",
			new Date("2026-01-10T00:00:00Z"),
			new Date("2026-01-11T00:00:00Z"),
		);

		assert.deepEqual(requestedUrls, [
			"https://cloud.example/remote.php/dav/public-calendars/public-token?export",
		]);
	} finally {
		globalThis.fetch = originalFetch;
	}
});

test("fetchCalendarEvents returns no events when ICS fetch fails", async () => {
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => new Response("not found", { status: 404 });

	try {
		const events = await fetchCalendarEvents(
			"https://calendar.example/missing.ics",
			new Date("2026-01-10T00:00:00Z"),
			new Date("2026-01-11T00:00:00Z"),
		);

		assert.deepEqual(events, []);
	} finally {
		globalThis.fetch = originalFetch;
	}
});
