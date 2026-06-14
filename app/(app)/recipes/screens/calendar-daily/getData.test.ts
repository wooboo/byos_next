import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import type { CalendarEvent } from "@/lib/calendar/ics";

const fetchCalendarEvents =
	vi.fn<(url: string, start: Date, end: Date) => Promise<CalendarEvent[]>>();

vi.mock("@/lib/calendar/ics", () => ({
	fetchCalendarEvents,
}));

describe("calendar-daily/getData", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 0, 13, 9, 45));
		fetchCalendarEvents.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("returns the current day and fetched events for the icsUrl", async () => {
		const event: CalendarEvent = {
			summary: "Planning",
			start: new Date(2026, 0, 13, 10, 0),
			end: new Date(2026, 0, 13, 11, 0),
			isAllDay: false,
		};
		fetchCalendarEvents.mockResolvedValueOnce([event]);

		const { default: getData } = await import("./getData");
		const data = await getData({ icsUrl: "https://example.com/calendar.ics" });

		assert.equal(fetchCalendarEvents.mock.calls.length, 1);
		assert.equal(
			fetchCalendarEvents.mock.calls[0][0],
			"https://example.com/calendar.ics",
		);
		assert.deepEqual(
			fetchCalendarEvents.mock.calls[0][1],
			new Date(2026, 0, 13),
		);
		assert.deepEqual(
			fetchCalendarEvents.mock.calls[0][2],
			new Date(2026, 0, 14),
		);
		assert.equal(data.dayName, "wtorek");
		assert.equal(data.isToday, true);
		assert.deepEqual(data.events, [event]);
	});

	it("returns an empty event list when no icsUrl is provided", async () => {
		const { default: getData } = await import("./getData");
		const data = await getData();

		assert.equal(fetchCalendarEvents.mock.calls.length, 0);
		assert.deepEqual(data.events, []);
		assert.equal(data.dayName, "wtorek");
	});
});
