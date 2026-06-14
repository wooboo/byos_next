import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import type { Mixup } from "@/lib/types";
import { MixupList } from "./mixup-list";

const mixups: Mixup[] = [
	{
		id: "mix-1",
		name: "Front desk rotation",
		layout_id: "quarters",
		created_at: null,
		updated_at: "2026-06-12T08:00:00.000Z",
	},
];

describe("MixupList", () => {
	it("renders an empty-state create tile when there are no mixups", () => {
		const html = renderToStaticMarkup(
			<MixupList mixups={[]} onCreateMixup={() => {}} />,
		);

		assert.match(html, /No mixups yet/);
		assert.match(html, /Create your first mixup/);
		assert.match(
			html,
			/Blend up to four recipes on one screen with a layout of your choice\./,
		);
	});

	it("renders mixup cards with preview urls and a secondary create tile", () => {
		const html = renderToStaticMarkup(
			<MixupList mixups={mixups} onCreateMixup={() => {}} />,
		);

		assert.match(html, /Front desk rotation/);
		assert.match(html, /quarters/);
		assert.match(html, /4 slots/);
		assert.match(
			html,
			/\/api\/bitmap\/mixup\/mix-1\.bmp\?width=800&amp;height=480&amp;grayscale=16/,
		);
		assert.match(html, /New mixup/);
	});
});
