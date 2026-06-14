import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchCalendarEvents } from "./ics.ts";

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

const ALL_DAY_FEED = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:all-day
DTSTAMP:20260101T000000Z
DTSTART;VALUE=DATE:20260112
DTEND;VALUE=DATE:20260113
END:VEVENT
END:VCALENDAR`;

const RECURRING_FEED = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:recurring
DTSTAMP:20260101T000000Z
DTSTART:20260110T090000Z
DTEND:20260110T093000Z
SUMMARY:Daily Standup
RRULE:FREQ=DAILY;COUNT=3
END:VEVENT
END:VCALENDAR`;

describe("fetchCalendarEvents", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("parses matching ICS events", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(ICAL_FEED));

		const events = await fetchCalendarEvents(
			"https://calendar.example/feed.ics",
			new Date("2026-01-10T00:00:00Z"),
			new Date("2026-01-11T00:00:00Z"),
		);

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			summary: "Planning",
			location: "Room 1",
			calendarName: "Team Calendar",
		});
		expect(events[0].start.toISOString()).toBe("2026-01-10T10:00:00.000Z");
		expect(events[0].end.toISOString()).toBe("2026-01-10T11:00:00.000Z");
	});

	it("returns no events for empty URL input without fetching", async () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch");

		const events = await fetchCalendarEvents(
			" , ; \n ",
			new Date("2026-01-10T00:00:00Z"),
			new Date("2026-01-11T00:00:00Z"),
		);

		expect(events).toEqual([]);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("fetches comma and semicolon separated feeds and sorts merged events", async () => {
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			if (String(input).includes("late")) {
				return new Response(
					ICAL_FEED.replace("20260110T100000Z", "20260110T120000Z"),
				);
			}
			return new Response(
				ICAL_FEED.replace("Planning", "Early").replace(
					"20260110T100000Z",
					"20260110T080000Z",
				),
			);
		});

		const events = await fetchCalendarEvents(
			"https://calendar.example/late.ics; https://calendar.example/early.ics",
			new Date("2026-01-10T00:00:00Z"),
			new Date("2026-01-11T00:00:00Z"),
		);

		expect(events.map((event) => event.start.toISOString())).toEqual([
			"2026-01-10T08:00:00.000Z",
			"2026-01-10T12:00:00.000Z",
		]);
		expect(events.map((event) => event.summary)).toEqual(["Early", "Planning"]);
	});

	it("marks all-day events and falls back when the summary is missing", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(ALL_DAY_FEED));

		const events = await fetchCalendarEvents(
			"https://calendar.example/all-day.ics",
			new Date("2026-01-12T00:00:00Z"),
			new Date("2026-01-13T00:00:00Z"),
		);

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			summary: "(bez tytułu)",
			isAllDay: true,
		});
	});

	it("expands recurring events that start inside the requested range", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(RECURRING_FEED),
		);

		const events = await fetchCalendarEvents(
			"https://calendar.example/recurring.ics",
			new Date("2026-01-11T00:00:00Z"),
			new Date("2026-01-12T23:59:59Z"),
		);

		expect(events.map((event) => event.start.toISOString())).toEqual([
			"2026-01-11T09:00:00.000Z",
			"2026-01-12T09:00:00.000Z",
		]);
		expect(events.every((event) => event.summary === "Daily Standup")).toBe(
			true,
		);
	});

	it("normalizes Nextcloud public calendar links", async () => {
		const requestedUrls: string[] = [];
		vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
			requestedUrls.push(String(input));
			return new Response(ICAL_FEED);
		});

		await fetchCalendarEvents(
			"https://cloud.example/apps/calendar/p/public-token/shared",
			new Date("2026-01-10T00:00:00Z"),
			new Date("2026-01-11T00:00:00Z"),
		);

		expect(requestedUrls).toEqual([
			"https://cloud.example/remote.php/dav/public-calendars/public-token?export",
		]);
	});

	it("returns no events when ICS fetch fails", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response("not found", { status: 404 }),
		);
		vi.spyOn(console, "error").mockImplementation(() => undefined);

		const events = await fetchCalendarEvents(
			"https://calendar.example/missing.ics",
			new Date("2026-01-10T00:00:00Z"),
			new Date("2026-01-11T00:00:00Z"),
		);

		expect(events).toEqual([]);
	});
});
