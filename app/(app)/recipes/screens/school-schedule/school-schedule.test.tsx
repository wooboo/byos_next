import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import SchoolSchedule from "./school-schedule";

describe("school-schedule screen", () => {
	it("renders lesson headers, subject labels, and child legend", () => {
		const html = renderToStaticMarkup(
			SchoolSchedule({
				periods: [
					{ num: 1, start: "8:00", end: "8:45" },
					{ num: 2, start: "8:55", end: "9:40" },
				],
				subjects: { ew: "EW", "j.ang": "ANG" },
				children: {
					ula: {
						name: "ULA",
						class: "1D",
						schedule: {
							monday: ["ew", null],
							tuesday: [null, null],
							wednesday: [null, null],
							thursday: [null, null],
							friday: [null, null],
						},
					},
					jerzyk: {
						name: "JERZYK",
						class: "2C",
						schedule: {
							monday: [null, "j.ang"],
							tuesday: [null, null],
							wednesday: [null, null],
							thursday: [null, null],
							friday: [null, null],
						},
					},
				},
			}),
		);

		assert.match(html, /PLAN LEKCJI/);
		assert.match(html, />ULA</);
		assert.match(html, />JERZYK</);
		assert.match(html, />EW</);
		assert.match(html, />ANG</);
		assert.match(html, />PN</);
	});
});
