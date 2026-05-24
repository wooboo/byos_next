import scheduleData from "@/data/school-schedule.json";

export type Period = { num: number; start: string; end: string };
export type Subjects = Record<string, string>;
export type WeekSchedule = Record<string, (string | null)[]>;
export type ChildData = { name: string; class: string; schedule: WeekSchedule };

export interface SchoolScheduleData {
	periods: Period[];
	subjects: Subjects;
	children: Record<string, ChildData>;
}

export default async function getData(
	_params?: Record<string, unknown>,
): Promise<SchoolScheduleData> {
	return scheduleData as SchoolScheduleData;
}
