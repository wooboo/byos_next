import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
	buildFontExportData,
	buildInitialFontData,
	buildPreviewSvgData,
	countDefinedCharacters,
	insertGridSize,
	parseUploadedFontData,
} from "./bitmap-font-designer-helpers.ts";
import { binaryToBase64 } from "./bitmap-font-utils.ts";

describe("bitmap-font-designer helpers", () => {
	it("builds initial font data maps from base64 font payloads", () => {
		const fontData = buildInitialFontData([
			{
				width: 2,
				height: 2,
				characters: [
					{ charCode: 65, char: "A", data: "kA==" },
					{ charCode: 66, char: "B", data: "QA==" },
				],
			},
		]);

		assert.deepEqual(Object.keys(fontData), ["2x2"]);
		assert.equal(fontData["2x2"].get(65), "10010000");
		assert.equal(fontData["2x2"].get(66), "01000000");
	});

	it("sorts inserted grid sizes by parsed width", () => {
		assert.deepEqual(insertGridSize(["7x8", "12x12"], "9x16"), [
			"7x8",
			"9x16",
			"12x12",
		]);
	});

	it("counts only defined non-space preview characters", () => {
		const charMap = new Map<number, string>([
			["A".charCodeAt(0), "1111"],
			["B".charCodeAt(0), "0001"],
		]);

		assert.equal(countDefinedCharacters("A B C", charMap), 2);
		assert.equal(countDefinedCharacters("   ", charMap), 0);
	});

	it("builds preview SVG layout with spacing and selected-character override", () => {
		const svgData = buildPreviewSvgData({
			characterBitmaps: new Map<number, string>([
				["A".charCodeAt(0), "1001"],
				["B".charCodeAt(0), "1111"],
			]),
			selectedGridSize: "2x2",
			previewText: "A B",
			previewScale: 2,
			previewGap: 1,
			selectedCharCode: "B".charCodeAt(0),
			currentCharacterBitmap: "0100",
		});

		assert.equal(svgData.width, 12);
		assert.equal(svgData.height, 4);
		assert.equal(svgData.charWidth, 4);
		assert.equal(svgData.charHeight, 4);
		assert.deepEqual(
			svgData.paths.map((item) => ({
				x: item.x,
				charCode: item.charCode,
				isSelected: item.isSelected,
				path: item.path.replaceAll(/\s+/g, " ").trim(),
			})),
			[
				{
					x: 0,
					charCode: 65,
					isSelected: false,
					path: "M 0 0 h 1 v 1 h -1 z M 1 1 h 1 v 1 h -1 z",
				},
				{
					x: 7,
					charCode: 66,
					isSelected: true,
					path: "M 1 0 h 1 v 1 h -1 z",
				},
			],
		);
	});

	it("parses uploaded font data and rejects invalid payloads", () => {
		const uploaded = parseUploadedFontData({
			fonts: [
				{
					width: 3,
					height: 5,
					characters: [
						{ charCode: 65, char: "A", data: binaryToBase64("101") },
					],
				},
			],
		});

		assert.deepEqual(uploaded.gridSizes, ["3x5"]);
		assert.equal(uploaded.fontDataObj["3x5"].get(65), "10100000");

		assert.throws(() => parseUploadedFontData({} as { fonts: never[] }), {
			message: "Invalid font data format: missing 'fonts' array",
		});
		assert.throws(
			() =>
				parseUploadedFontData({
					fonts: [
						{
							width: 1,
							height: 1,
							characters: [{ charCode: "A", data: "AA==" }],
						},
					],
				} as unknown as { fonts: never[] }),
			{ message: "Invalid character data structure" },
		);
	});

	it("builds export payloads, drops empty fonts, and generates timestamped filenames", () => {
		const now = new Date("2026-06-13T08:45:00.000Z");
		const { exportData, filename } = buildFontExportData({
			availableGridSizes: ["2x2", "3x3"],
			selectedGridSize: "2x2",
			fontData: {
				"2x2": new Map<number, string>([
					[67, "0000"],
					[65, "0000"],
				]),
				"3x3": new Map<number, string>([[90, "000000000"]]),
			},
			characterBitmaps: new Map<number, string>([
				[67, "1111"],
				[65, "0011"],
			]),
			currentCharacterBitmap: "1000",
			selectedCharCode: 65,
			now,
		});

		const expectedFilename = `bitmap-font-${now.getFullYear()}-${(
			now.getMonth() + 1
		)
			.toString()
			.padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}-${now
			.getHours()
			.toString()
			.padStart(2, "0")}${now.getMinutes().toString().padStart(2, "0")}.json`;

		assert.equal(filename, expectedFilename);
		assert.equal(exportData.metadata.createdAt, "2026-06-13T08:45:00.000Z");
		assert.deepEqual(exportData.fonts, [
			{
				width: 2,
				height: 2,
				characters: [
					{ charCode: 65, char: "A", data: "gA==" },
					{ charCode: 67, char: "C", data: "8A==" },
				],
			},
		]);
	});
});
