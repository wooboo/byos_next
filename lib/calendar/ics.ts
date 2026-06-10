import ICAL from "ical.js";

export interface CalendarEvent {
	summary: string;
	start: Date;
	end: Date;
	isAllDay: boolean;
	location?: string;
	calendarName?: string;
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

function optionalString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

async function fetchSingleCalendar(
	icsUrl: string,
	rangeStart: Date,
	rangeEnd: Date,
): Promise<CalendarEvent[]> {
	// Normalize Nextcloud public share links to ICS export URL
	const normalized = icsUrl.replace(
		/apps\/calendar\/p\/([^/?]+).*/,
		"remote.php/dav/public-calendars/$1?export",
	);
	const url = normalized.startsWith("http")
		? normalized
		: `${icsUrl.split("/").slice(0, 3).join("/")}/${normalized}`;

	const res = await fetch(url, { next: { revalidate: 900 } });
	if (!res.ok) {
		console.error(`ICS fetch failed: ${res.status} for ${icsUrl}`);
		return [];
	}

	const text = await res.text();
	const jcalData = ICAL.parse(text);
	const comp = new ICAL.Component(jcalData);
	const vevents = comp.getAllSubcomponents("vevent");

	const events: CalendarEvent[] = [];

	for (const vevent of vevents) {
		const event = new ICAL.Event(vevent);

		// Check if this is a recurring event
		if (event.isRecurring()) {
			try {
				const expand = new ICAL.RecurExpansion({
					component: comp,
					dtstart: ICAL.Time.fromJSDate(rangeStart),
				});

				let occ = expand.next();
				while (occ) {
					const jsDate = occ.toJSDate();
					if (jsDate > rangeEnd) break;

					if (jsDate >= rangeStart) {
						events.push({
							summary: event.summary || "(bez tytułu)",
							start: jsDate,
							end: new Date(
								jsDate.getTime() + (event.duration?.toSeconds() ?? 3600) * 1000,
							),
							isAllDay: event.startDate.isDate,
							location: event.location || undefined,
							calendarName: optionalString(
								comp.getFirstPropertyValue("x-wr-calname"),
							),
						});
					}
					occ = expand.next();
				}
			} catch {
				// RecurExpansion might fail for non-standard RRULEs
				// Fall through to single-event handling
			}
		} else {
			// Single event
			const start = event.startDate.toJSDate();
			const end = event.endDate?.toJSDate() || start;

			if (start <= rangeEnd && end >= rangeStart) {
				events.push({
					summary: event.summary || "(bez tytułu)",
					start,
					end,
					isAllDay: event.startDate.isDate,
					location: event.location || undefined,
					calendarName: optionalString(
						comp.getFirstPropertyValue("x-wr-calname"),
					),
				});
			}
		}
	}

	events.sort((a, b) => a.start.getTime() - b.start.getTime());
	return events;
}
