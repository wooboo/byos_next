import ICAL from "ical.js";

export interface CalendarEvent {
	summary: string;
	start: Date;
	end: Date;
	isAllDay: boolean;
	location?: string;
	calendarName?: string;
}

function optionalString(value: unknown): string | undefined {
	if (value === null || value === undefined) return undefined;
	return typeof value === "string" ? value : String(value);
}

function normalizeIcsUrl(icsUrl: string): string {
	const normalized = icsUrl.replace(
		/apps\/calendar\/p\/([^/?]+).*/,
		"remote.php/dav/public-calendars/$1?export",
	);
	return normalized.startsWith("http")
		? normalized
		: `${icsUrl.split("/").slice(0, 3).join("/")}/${normalized}`;
}

async function fetchCalendarText(icsUrl: string): Promise<string | null> {
	const url = normalizeIcsUrl(icsUrl);
	const res = await fetch(url, { next: { revalidate: 900 } });
	if (res.ok) return res.text();

	console.error(`ICS fetch failed: ${res.status} for ${icsUrl}`);
	return null;
}

function calendarName(comp: ICAL.Component): string | undefined {
	return optionalString(comp.getFirstPropertyValue("x-wr-calname"));
}

function eventDurationMs(event: ICAL.Event): number {
	return (event.duration?.toSeconds() ?? 3600) * 1000;
}

function toCalendarEvent(
	event: ICAL.Event,
	start: Date,
	end: Date,
	sourceCalendarName: string | undefined,
): CalendarEvent {
	return {
		summary: event.summary || "(bez tytułu)",
		start,
		end,
		isAllDay: event.startDate.isDate,
		location: optionalString(event.location),
		calendarName: sourceCalendarName,
	};
}

function dateRangesOverlap(
	start: Date,
	end: Date,
	rangeStart: Date,
	rangeEnd: Date,
): boolean {
	return start <= rangeEnd && end >= rangeStart;
}

function createRecurExpansion(
	comp: ICAL.Component,
	rangeStart: Date,
): ICAL.RecurExpansion | null {
	try {
		return new ICAL.RecurExpansion({
			component: comp,
			dtstart: ICAL.Time.fromJSDate(rangeStart),
		});
	} catch {
		// RecurExpansion might fail for non-standard RRULEs.
		return null;
	}
}

function recurringOccurrenceEvent(
	event: ICAL.Event,
	start: Date,
	rangeStart: Date,
	sourceCalendarName: string | undefined,
): CalendarEvent[] {
	if (start < rangeStart) return [];

	const end = new Date(start.getTime() + eventDurationMs(event));
	return [toCalendarEvent(event, start, end, sourceCalendarName)];
}

function recurringEventsInRange(
	event: ICAL.Event,
	comp: ICAL.Component,
	rangeStart: Date,
	rangeEnd: Date,
	sourceCalendarName: string | undefined,
): CalendarEvent[] {
	const expand = createRecurExpansion(comp, rangeStart);
	if (expand === null) return [];

	const events: CalendarEvent[] = [];
	let occ = expand.next();
	while (occ) {
		const start = occ.toJSDate();
		if (start > rangeEnd) break;

		events.push(
			...recurringOccurrenceEvent(event, start, rangeStart, sourceCalendarName),
		);
		occ = expand.next();
	}

	return events;
}

function singleEventInRange(
	event: ICAL.Event,
	rangeStart: Date,
	rangeEnd: Date,
	sourceCalendarName: string | undefined,
): CalendarEvent[] {
	const start = event.startDate.toJSDate();
	const end = event.endDate?.toJSDate() || start;
	if (!dateRangesOverlap(start, end, rangeStart, rangeEnd)) return [];

	return [toCalendarEvent(event, start, end, sourceCalendarName)];
}

function eventOccurrencesInRange(
	event: ICAL.Event,
	comp: ICAL.Component,
	rangeStart: Date,
	rangeEnd: Date,
	sourceCalendarName: string | undefined,
): CalendarEvent[] {
	if (!event.isRecurring()) {
		return singleEventInRange(event, rangeStart, rangeEnd, sourceCalendarName);
	}

	return recurringEventsInRange(
		event,
		comp,
		rangeStart,
		rangeEnd,
		sourceCalendarName,
	);
}

/**
 * Fetches and parses ICS feeds, returning merged events for the given date range.
 * Accepts a single URL or comma/semicolon-separated list of URLs.
 */
export async function fetchCalendarEvents(
	icsUrls: string,
	rangeStart: Date,
	rangeEnd: Date,
): Promise<CalendarEvent[]> {
	const urls = icsUrls
		.split(/[,;\n]+/)
		.map((u) => u.trim())
		.filter(Boolean);

	if (urls.length === 0) return [];

	const allEvents: CalendarEvent[] = [];

	for (const rawUrl of urls) {
		const events = await fetchSingleCalendar(rawUrl, rangeStart, rangeEnd);
		allEvents.push(...events);
	}

	allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
	return allEvents;
}

async function fetchSingleCalendar(
	icsUrl: string,
	rangeStart: Date,
	rangeEnd: Date,
): Promise<CalendarEvent[]> {
	const text = await fetchCalendarText(icsUrl);
	if (text === null) return [];

	const jcalData = ICAL.parse(text);
	const comp = new ICAL.Component(jcalData);
	const vevents = comp.getAllSubcomponents("vevent");
	const sourceCalendarName = calendarName(comp);
	const events: CalendarEvent[] = [];

	for (const vevent of vevents) {
		const event = new ICAL.Event(vevent);
		events.push(
			...eventOccurrencesInRange(
				event,
				comp,
				rangeStart,
				rangeEnd,
				sourceCalendarName,
			),
		);
	}

	events.sort((a, b) => a.start.getTime() - b.start.getTime());
	return events;
}
