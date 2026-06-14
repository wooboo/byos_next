import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import type { CalendarEvent } from "@/lib/calendar/ics";

const fetchCalendarEvents =
	vi.fn<(url: string, start: Date, end: Date) => Promise<CalendarEvent[]>>();

vi.mock("@/lib/calendar/ics", () => ({
	fetchCalendarEvents,
}));

describe("calendar-monthly/getData", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 0, 13, 9, 30));
		fetchCalendarEvents.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("builds padded calendar weeks and attaches events by date", async () => {
		const event: CalendarEvent = {
			summary: "Release",
			start: new Date(2026, 0, 13, 14, 0),
			end: new Date(2026, 0, 13, 15, 0),
			isAllDay: false,
		};
		fetchCalendarEvents.mockResolvedValueOnce([event]);

		const { default: getData } = await import("./getData");
		const data = await getData({ icsUrl: "https://example.com/month.ics" });

		assert.deepEqual(
			fetchCalendarEvents.mock.calls[0][1],
			new Date(2025, 11, 29),
		);
		assert.deepEqual(
			fetchCalendarEvents.mock.calls[0][2],
			new Date(2026, 1, 1),
		);
		assert.equal(data.year, 2026);
		assert.equal(data.month, 0);
		assert.equal(data.monthName, "styczeń");
		assert.equal(data.days.length, 5);
		assert.equal(data.days[0][0].day, null);
		assert.equal(data.days[2][1].day, 13);
		assert.equal(data.days[2][1].isToday, true);
		assert.equal(data.days[0][5].isWeekend, true);
		assert.deepEqual(data.days[2][1].events, [event]);
	});

	it("returns a month grid without events when icsUrl is absent", async () => {
		const { default: getData } = await import("./getData");
		const data = await getData();

		assert.equal(fetchCalendarEvents.mock.calls.length, 0);
		assert.ok(data.days.flat().every((day) => day.events.length === 0));
	});
});
