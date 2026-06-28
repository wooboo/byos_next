import assert from "node:assert/strict";
import sharp from "sharp";
import { DitheringMethod, renderBmp } from "./render-bmp";

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

async function solidRgbPng(
	width: number,
	height: number,
	background: { r: number; g: number; b: number },
) {
	return sharp({
		create: {
			width,
			height,
			channels: 3,
			background,
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

const paperColorPalette = [
	[0, 0, 0],
	[255, 255, 255],
	[255, 243, 56],
	[191, 0, 0],
	[100, 64, 255],
	[67, 138, 28],
] as const;

describe("renderBmp PaperColor palette support", () => {
	it("renders 600x400 PaperColor BMPs as 4-bit indexed color", async () => {
		const png = await solidRgbPng(600, 400, { r: 255, g: 255, b: 255 });

		const bmp = await renderBmp(png, {
			width: 600,
			height: 400,
			palette: paperColorPalette,
			ditheringMethod: DitheringMethod.NONE,
			applyEdgeSnap: false,
		});
		const info = bmpInfo(bmp);

		assert.deepEqual(info, {
			signature: "BM",
			fileSize: 120_078,
			dataOffset: 78,
			infoHeaderSize: 40,
			width: 600,
			height: 400,
			planes: 1,
			bitsPerPixel: 4,
			compression: 0,
			imageSize: 120_000,
			colorCount: 6,
			importantColors: 6,
		});
		assert.deepEqual(
			paletteEntries(bmp, 6),
			[0x000000, 0xffffff, 0xfff338, 0xbf0000, 0x6440ff, 0x438a1c],
		);
	});

	it("uses a calibrated dither palette while keeping native BMP palette entries", async () => {
		const observedPaperColorPalette = [
			[70, 66, 95],
			[178, 193, 184],
			[175, 153, 0],
			[97, 65, 72],
			[19, 80, 155],
			[36, 109, 40],
		] as const;
		const png = await pngFromRgb(1, 1, [97, 65, 72]);

		const bmp = await renderBmp(png, {
			width: 1,
			height: 1,
			palette: paperColorPalette,
			ditherPalette: observedPaperColorPalette,
			ditheringMethod: DitheringMethod.NONE,
			applyEdgeSnap: false,
		});
		const info = bmpInfo(bmp);

		assert.deepEqual(
			paletteEntries(bmp, 6),
			[0x000000, 0xffffff, 0xfff338, 0xbf0000, 0x6440ff, 0x438a1c],
		);
		assert.equal(bmp[info.dataOffset], 0x30);
	});
});
