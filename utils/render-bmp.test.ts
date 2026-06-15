import assert from "node:assert/strict";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { DitheringMethod, renderBmp } from "./render-bmp.ts";

async function pngFromGrayscale(
	width: number,
	height: number,
	pixels: number[],
) {
	return sharp(Buffer.from(pixels), {
		raw: {
			width,
			height,
			channels: 1,
		},
	})
		.png()
		.toBuffer();
}

async function pngFromRgb(width: number, height: number, pixels: number[]) {
	return sharp(Buffer.from(pixels), {
		raw: {
			width,
			height,
			channels: 3,
		},
	})
		.png()
		.toBuffer();
}

function bmpInfo(buffer: Buffer) {
	return {
		signature: buffer.toString("ascii", 0, 2),
		fileSize: buffer.readUInt32LE(2),
		dataOffset: buffer.readUInt32LE(10),
		infoHeaderSize: buffer.readUInt32LE(14),
		width: buffer.readInt32LE(18),
		height: buffer.readInt32LE(22),
		planes: buffer.readUInt16LE(26),
		bitsPerPixel: buffer.readUInt16LE(28),
		compression: buffer.readUInt32LE(30),
		imageSize: buffer.readUInt32LE(34),
		colorCount: buffer.readUInt32LE(46),
		importantColors: buffer.readUInt32LE(50),
	};
}

function paletteEntries(buffer: Buffer, count: number) {
	const paletteOffset = 14 + 40;
	return Array.from({ length: count }, (_, index) =>
		buffer.readUInt32LE(paletteOffset + index * 4),
	);
}

describe("renderBmp", () => {
	it("renders monochrome BMPs with expected headers, palette, and packed rows", async () => {
		const png = await pngFromGrayscale(
			8,
			2,
			[0, 0, 255, 255, 0, 0, 255, 255, 255, 0, 255, 0, 255, 0, 255, 0],
		);

		const bmp = await renderBmp(png, {
			width: 8,
			height: 2,
			grayscale: 2,
			ditheringMethod: DitheringMethod.NONE,
			applyEdgeSnap: false,
		});
		const info = bmpInfo(bmp);

		assert.deepEqual(info, {
			signature: "BM",
			fileSize: 70,
			dataOffset: 62,
			infoHeaderSize: 40,
			width: 8,
			height: 2,
			planes: 1,
			bitsPerPixel: 1,
			compression: 0,
			imageSize: 8,
			colorCount: 2,
			importantColors: 2,
		});
		assert.deepEqual(paletteEntries(bmp, 2), [0x000000, 0xffffff]);
		assert.equal(bmp[info.dataOffset], 0b10101010);
		assert.equal(bmp[info.dataOffset + 4], 0b00110011);
	});

	it("renders 4-level BMPs and supports inverted palette indices", async () => {
		const png = await pngFromGrayscale(4, 1, [0, 85, 170, 255]);

		const bmp = await renderBmp(png, {
			width: 4,
			height: 1,
			grayscale: 4,
			inverted: true,
			ditheringMethod: DitheringMethod.NONE,
			applyEdgeSnap: false,
		});
		const info = bmpInfo(bmp);

		assert.equal(info.bitsPerPixel, 2);
		assert.equal(info.colorCount, 4);
		assert.deepEqual(
			paletteEntries(bmp, 4),
			[0x000000, 0x555555, 0xaaaaaa, 0xffffff],
		);
		assert.equal(bmp[info.dataOffset], 0b11100100);
	});

	it("resizes double-size PNGs and renders 16-level BMPs", async () => {
		const png = await pngFromGrayscale(4, 2, [0, 0, 255, 255, 0, 0, 255, 255]);

		const bmp = await renderBmp(png, {
			width: 2,
			height: 1,
			grayscale: 16,
			ditheringMethod: DitheringMethod.NONE,
			applyEdgeSnap: false,
		});
		const info = bmpInfo(bmp);

		assert.equal(info.width, 2);
		assert.equal(info.height, 1);
		assert.equal(info.bitsPerPixel, 4);
		assert.equal(info.colorCount, 16);
		assert.equal(info.dataOffset, 118);
		assert.deepEqual(
			paletteEntries(bmp, 4),
			[0x000000, 0x111111, 0x222222, 0x333333],
		);
		assert.equal(bmp[info.dataOffset], 0x0f);
	});

	it("renders 256-color BMPs as 8-bit indexed color", async () => {
		const png = await pngFromRgb(3, 1, [255, 0, 0, 0, 128, 255, 12, 220, 40]);

		const bmp = await renderBmp(png, {
			width: 3,
			height: 1,
			grayscale: 256,
		});
		const info = bmpInfo(bmp);

		assert.equal(info.bitsPerPixel, 8);
		assert.equal(info.colorCount, 256);
		assert.equal(info.importantColors, 256);
		assert.equal(info.dataOffset, 1078);
		assert.deepEqual(
			paletteEntries(bmp, 6),
			[0x000000, 0x000033, 0x000066, 0x000099, 0x0000cc, 0x0000ff],
		);
		expect(Array.from(bmp.slice(info.dataOffset, info.dataOffset + 4))).toEqual(
			[180, 23, 25, 0],
		);
	});

	it("rejects unsupported grayscale levels", async () => {
		const png = await pngFromGrayscale(1, 1, [0]);

		await assert.rejects(
			() => renderBmp(png, { width: 1, height: 1, grayscale: 3 }),
			/Invalid grayscale value: 3/,
		);
	});

	it("pads partial monochrome bytes and leaves row padding zeroed", async () => {
		const png = await pngFromGrayscale(5, 1, [255, 0, 255, 0, 255]);

		const bmp = await renderBmp(png, {
			width: 5,
			height: 1,
			grayscale: 2,
			ditheringMethod: DitheringMethod.NONE,
			applyEdgeSnap: false,
		});
		const info = bmpInfo(bmp);

		expect(info.imageSize).toBe(4);
		expect(bmp[info.dataOffset]).toBe(0b10101000);
		expect(
			Array.from(bmp.slice(info.dataOffset + 1, info.dataOffset + 4)),
		).toEqual([0, 0, 0]);
	});

	it("packs multi-bit grayscale rows when the pixel count is not byte-aligned", async () => {
		const png = await pngFromGrayscale(3, 1, [0, 170, 255]);

		const bmp = await renderBmp(png, {
			width: 3,
			height: 1,
			grayscale: 4,
			ditheringMethod: DitheringMethod.NONE,
			applyEdgeSnap: false,
		});
		const info = bmpInfo(bmp);

		expect(info.bitsPerPixel).toBe(2);
		expect(bmp[info.dataOffset]).toBe(0b00101100);
		expect(
			Array.from(bmp.slice(info.dataOffset + 1, info.dataOffset + 4)),
		).toEqual([0, 0, 0]);
	});
});
