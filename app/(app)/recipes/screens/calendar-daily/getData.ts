import { type CalendarEvent, fetchCalendarEvents } from "@/lib/calendar/ics";

export interface DayData {
	date: Date;
	dayName: string;
	isToday: boolean;
	events: CalendarEvent[];
}

const DAY_NAMES = [
	"niedziela",
	"poniedziałek",
	"wtorek",
	"środa",
	"czwartek",
	"piątek",
	"sobota",
];
const MONTHS_PL = [
	"stycznia",
	"lutego",
	"marca",
	"kwietnia",
	"maja",
	"czerwca",
	"lipca",
	"sierpnia",
	"września",
	"października",
	"listopada",
	"grudnia",
];

export default async function getData(
	params?: Record<string, unknown>,
): Promise<DayData> {
	const icsUrl = (params?.icsUrl as string) || "";
	const now = new Date();

	const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const dayEnd = new Date(dayStart);
	dayEnd.setDate(dayEnd.getDate() + 1);

	const events = icsUrl
		? await fetchCalendarEvents(icsUrl, dayStart, dayEnd)
		: [];

	return {
		date: now,
		dayName: DAY_NAMES[now.getDay()],
		isToday: true,
		events,
	};
}
