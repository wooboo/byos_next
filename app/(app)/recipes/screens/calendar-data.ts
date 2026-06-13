import type { CalendarEvent } from "@/lib/calendar/ics";

export function calendarDateKey(date: Date): string {
	return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function groupEventsByCalendarDate(
	events: CalendarEvent[],
): Map<string, CalendarEvent[]> {
	const grouped = new Map<string, CalendarEvent[]>();
	for (const event of events) {
		const key = calendarDateKey(new Date(event.start));
		const dayEvents = grouped.get(key) ?? [];
		dayEvents.push(event);
		grouped.set(key, dayEvents);
	}
	return grouped;
}

export function eventsForDate(
	groupedEvents: Map<string, CalendarEvent[]>,
	date: Date,
): CalendarEvent[] {
	return groupedEvents.get(calendarDateKey(date)) ?? [];
}

export function startOfLocalDay(date: Date): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isWeekendDate(date: Date): boolean {
	const dayOfWeek = date.getDay();
	return dayOfWeek === 0 || dayOfWeek === 6;
}
