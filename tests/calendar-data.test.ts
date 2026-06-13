import assert from "node:assert/strict";
import test from "node:test";
import {
	calendarDateKey,
	eventsForDate,
	groupEventsByCalendarDate,
	isWeekendDate,
	startOfLocalDay,
} from "../app/(app)/recipes/screens/calendar-data.ts";
import type { CalendarEvent } from "../lib/calendar/ics.ts";

function event(summary: string, start: Date): CalendarEvent {
	return {
		summary,
		start,
		end: new Date(start.getTime() + 60_000),
		isAllDay: false,
	};
}

test("calendarDateKey uses local date parts", () => {
	const date = new Date(2026, 0, 10, 23, 30);

	assert.equal(calendarDateKey(date), "2026-0-10");
});

test("groupEventsByCalendarDate groups multiple events on the same local day", () => {
	const first = event("morning", new Date(2026, 0, 10, 9));
	const second = event("evening", new Date(2026, 0, 10, 18));
	const grouped = groupEventsByCalendarDate([
		first,
		event("tomorrow", new Date(2026, 0, 11, 9)),
		second,
	]);

	assert.deepEqual(eventsForDate(grouped, new Date(2026, 0, 10)), [
		first,
		second,
	]);
});

test("eventsForDate returns an empty array when no events match", () => {
	const grouped = groupEventsByCalendarDate([
		event("other", new Date(2026, 0, 10, 9)),
	]);

	assert.deepEqual(eventsForDate(grouped, new Date(2026, 0, 12)), []);
});

test("startOfLocalDay and isWeekendDate expose calendar date primitives", () => {
	assert.deepEqual(
		startOfLocalDay(new Date(2026, 0, 10, 13, 45)),
		new Date(2026, 0, 10),
	);
	assert.equal(isWeekendDate(new Date(2026, 0, 10)), true);
	assert.equal(isWeekendDate(new Date(2026, 0, 12)), false);
});
