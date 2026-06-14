import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import type { CalendarEvent } from "@/lib/calendar/ics";

const fetchCalendarEvents =
	vi.fn<(url: string, start: Date, end: Date) => Promise<CalendarEvent[]>>();

vi.mock("@/lib/calendar/ics", () => ({
	fetchCalendarEvents,
}));

describe("calendar-weekly/getData", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 0, 14, 8, 0));
		fetchCalendarEvents.mockReset();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("builds a monday-first week and groups events onto matching days", async () => {
		const tuesdayEvent: CalendarEvent = {
			summary: "Retro",
			start: new Date(2026, 0, 13, 9, 0),
			end: new Date(2026, 0, 13, 10, 0),
			isAllDay: false,
		};
		const saturdayEvent: CalendarEvent = {
			summary: "Family",
			start: new Date(2026, 0, 17, 12, 0),
			end: new Date(2026, 0, 17, 13, 0),
			isAllDay: false,
		};
		fetchCalendarEvents.mockResolvedValueOnce([tuesdayEvent, saturdayEvent]);

		const { default: getData } = await import("./getData");
		const data = await getData({ icsUrl: "https://example.com/week.ics" });

		assert.deepEqual(
			fetchCalendarEvents.mock.calls[0][1],
			new Date(2026, 0, 12),
		);
		assert.deepEqual(
			fetchCalendarEvents.mock.calls[0][2],
			new Date(2026, 0, 19),
		);
		assert.equal(data.days.length, 7);
		assert.equal(data.days[0].name, "poniedziałek");
		assert.equal(data.days[2].isToday, true);
		assert.deepEqual(data.days[1].events, [tuesdayEvent]);
		assert.equal(data.days[5].isWeekend, true);
		assert.deepEqual(data.days[5].events, [saturdayEvent]);
	});

	it("returns empty days when icsUrl is missing", async () => {
		const { default: getData } = await import("./getData");
		const data = await getData({});

		assert.equal(fetchCalendarEvents.mock.calls.length, 0);
		assert.ok(data.days.every((day) => day.events.length === 0));
	});
});
