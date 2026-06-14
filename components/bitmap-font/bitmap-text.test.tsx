import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { binaryToBase64 } from "@/app/(app)/tools/tools-components/bitmap-font-designer/bitmap-font-utils";
import { BitmapText } from "./bitmap-text";

function createFontData() {
	return {
		fonts: [
			{
				width: 2,
				height: 2,
				characters: [
					{
						charCode: "A".charCodeAt(0),
						char: "A",
						data: binaryToBase64("1001"),
					},
					{
						charCode: "B".charCodeAt(0),
						char: "B",
						data: binaryToBase64("1111"),
					},
				],
			},
			{
				width: 3,
				height: 5,
				characters: [
					{
						charCode: "A".charCodeAt(0),
						char: "A",
						data: binaryToBase64("111111111111111"),
					},
				],
			},
		],
	};
}

describe("bitmap-text", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("renders bitmap glyphs with scale, gap, spacing, and aria metadata", () => {
		const html = renderToStaticMarkup(
			<BitmapText
				text="A B?"
				fontData={createFontData()}
				gridSize="2x2"
				scale={2}
				gap={1}
				className="bitmap"
			/>,
		);

		expect(html).toContain('class="bitmap"');
		expect(html).toContain('role="img"');
		expect(html).toContain('aria-label="Bitmap text: A B?"');
		expect(html).toContain('width="16"');
		expect(html).toContain('height="4"');
		expect(html).toContain('viewBox="0 0 16 4"');
		expect(html).toContain('transform="translate(0, 0) scale(2)"');
		expect(html).toContain('transform="translate(7, 0) scale(2)"');
		expect(html).toMatch(/d="M 0 0 h 1 v 1 h -1 z\s+M 1 1 h 1 v 1 h -1 z"/);
		expect(html).toContain('d="M 0 0 h 1 v 1 h -1 z M 1 0 h 1 v 1 h -1 z');
		expect(html.match(/<path /g)?.length).toBe(2);
	});

	it("falls back to the first available font when the requested grid size is missing", () => {
		const html = renderToStaticMarkup(
			<BitmapText text="A" fontData={createFontData()} gridSize="9x9" />,
		);

		expect(html).toContain('width="2"');
		expect(html).toContain('height="2"');
		expect(html).toContain('viewBox="0 0 2 2"');
	});

	it("returns nothing for empty text or when no font is available", () => {
		expect(
			renderToStaticMarkup(
				<BitmapText text="" fontData={createFontData()} gridSize="2x2" />,
			),
		).toBe("");

		expect(
			renderToStaticMarkup(
				<BitmapText text="A" fontData={{ fonts: [] }} gridSize="2x2" />,
			),
		).toBe("");
	});

	it("returns nothing and logs when font JSON cannot be parsed", () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const html = renderToStaticMarkup(
			<BitmapText text="A" fontData="{not-json}" gridSize="2x2" />,
		);

		expect(html).toBe("");
		expect(errorSpy).toHaveBeenCalledWith(
			"Error parsing font data:",
			expect.any(SyntaxError),
		);
	});
});
