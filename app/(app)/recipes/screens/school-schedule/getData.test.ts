import assert from "node:assert/strict";
import { describe, it } from "vitest";
import getData from "./getData";

describe("school-schedule/getData", () => {
	it("returns the bundled school schedule fixture", async () => {
		const data = await getData();

		assert.equal(data.periods.length, 8);
		assert.equal(data.periods[0].start, "8:00");
		assert.equal(data.subjects["j.ang"], "ANG");
		assert.equal(data.children.ula.name, "ULA");
		assert.equal(data.children.jerzyk.schedule.wednesday[3], "b");
	});
});
