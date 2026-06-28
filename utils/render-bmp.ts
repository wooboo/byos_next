import sharp from "sharp";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
} from "@/lib/recipes/constants";
import {
	applyColorPaletteDithering,
	applyDithering,
	DitheringMethod,
	type RgbPalette,
} from "./image-processing";

export { DitheringMethod };

export interface RenderBmpOptions {
	ditheringMethod?: DitheringMethod;
	inverted?: boolean;
	width?: number;
	height?: number;
	grayscale?: number; // 2, 4, 16 gray levels, or 256 indexed colors
	palette?: RgbPalette;
	ditherPalette?: RgbPalette;
	applyEdgeSnap?: boolean;
}

const createGrayscalePaletteEntries = (grayscale: number): number[] => {
	const paletteStep = 255 / (grayscale - 1);

	return Array.from({ length: grayscale }, (_, index) => {
		const grayValue = Math.round(index * paletteStep);
		return (grayValue << 16) | (grayValue << 8) | grayValue;
	});
};

const createIndexedColorPaletteEntries = (): number[] => {
	const entries: number[] = [];
	const steps = [0, 51, 102, 153, 204, 255];

	for (const red of steps) {
		for (const green of steps) {
			for (const blue of steps) {
				entries.push((red << 16) | (green << 8) | blue);
			}
		}
	}

	for (let index = 0; entries.length < 256; index++) {
		const grayValue = Math.round((index / 39) * 255);
		entries.push((grayValue << 16) | (grayValue << 8) | grayValue);
	}

	return entries;
};

const mapGrayscaleValueToPaletteIndex = (
	value: number,
	grayscale: number,
): number => {
	const paletteStep = 255 / (grayscale - 1);
	return Math.round(value / paletteStep);
};

const shouldSetMonochromeBit = (
	paletteIndex: number,
	grayscale: number,
): boolean => paletteIndex === grayscale - 1;

const createColorPaletteEntries = (palette: RgbPalette): number[] =>
	palette.map(([red, green, blue]) => (red << 16) | (green << 8) | blue);

const getBitsPerPixel = (colorCount: number): number => {
	if (colorCount <= 2) return 1;
	if (colorCount <= 4) return 2;
	if (colorCount <= 16) return 4;
	if (colorCount <= 256) return 8;
	throw new Error(`Invalid palette size: ${colorCount}. Must be 256 or less`);
};

function getPaletteIndex(
	value: number,
	grayscale: number,
	inverted: boolean,
): number {
	const paletteIndex = mapGrayscaleValueToPaletteIndex(value, grayscale);
	return inverted ? grayscale - 1 - paletteIndex : paletteIndex;
}

function nearestIndexedColorPaletteIndex(
	red: number,
	green: number,
	blue: number,
): number {
	const redIndex = Math.round(red / 51);
	const greenIndex = Math.round(green / 51);
	const blueIndex = Math.round(blue / 51);
	return redIndex * 36 + greenIndex * 6 + blueIndex;
}

function writePackedBitmapRows({
	buffer,
	dataOffset,
	dithered,
	grayscale,
	inverted,
	rowSize,
	targetHeight,
	targetWidth,
	bitsPerPixel,
}: {
	buffer: Buffer;
	dataOffset: number;
	dithered: Uint8Array;
	grayscale: number;
	inverted: boolean;
	rowSize: number;
	targetHeight: number;
	targetWidth: number;
	bitsPerPixel: number;
}) {
	const pixelsPerByte = 8 / bitsPerPixel;
	const byteIndexShift = Math.log2(pixelsPerByte);

	for (let y = 0; y < targetHeight; y++) {
		const targetY = targetHeight - 1 - y;
		const yOffset = targetY * targetWidth;
		const destRowOffset = dataOffset + y * rowSize;

		for (let x = 0; x < targetWidth; x += pixelsPerByte) {
			let byte = 0;
			const remainingPixels = Math.min(pixelsPerByte, targetWidth - x);

			for (let bit = 0; bit < remainingPixels; bit++) {
				const idx = yOffset + x + bit;
				const paletteIndex = getPaletteIndex(
					dithered[idx],
					grayscale,
					inverted,
				);
				const pixelValue =
					bitsPerPixel === 1
						? Number(shouldSetMonochromeBit(paletteIndex, grayscale))
						: paletteIndex;
				byte |= pixelValue << ((pixelsPerByte - 1 - bit) * bitsPerPixel);
			}

			buffer[destRowOffset + (x >> byteIndexShift)] = byte;
		}
	}
}

function writeIndexed8BitmapRows({
	buffer,
	data,
	dataOffset,
	rowSize,
	targetHeight,
	targetWidth,
}: {
	buffer: Buffer;
	data: Buffer;
	dataOffset: number;
	rowSize: number;
	targetHeight: number;
	targetWidth: number;
}) {
	for (let y = 0; y < targetHeight; y++) {
		const targetY = targetHeight - 1 - y;
		const yOffset = targetY * targetWidth;
		const destRowOffset = dataOffset + y * rowSize;

		for (let x = 0; x < targetWidth; x++) {
			const sourceOffset = (yOffset + x) * 3;
			buffer[destRowOffset + x] = nearestIndexedColorPaletteIndex(
				data[sourceOffset] ?? 0,
				data[sourceOffset + 1] ?? 0,
				data[sourceOffset + 2] ?? 0,
			);
		}
	}
}

function writePackedIndexedBitmapRows({
	bitsPerPixel,
	buffer,
	dataOffset,
	paletteIndices,
	rowSize,
	targetHeight,
	targetWidth,
}: {
	bitsPerPixel: number;
	buffer: Buffer;
	dataOffset: number;
	paletteIndices: Uint8Array;
	rowSize: number;
	targetHeight: number;
	targetWidth: number;
}) {
	const pixelsPerByte = 8 / bitsPerPixel;
	const byteIndexShift = Math.log2(pixelsPerByte);

	for (let y = 0; y < targetHeight; y++) {
		const targetY = targetHeight - 1 - y;
		const yOffset = targetY * targetWidth;
		const destRowOffset = dataOffset + y * rowSize;

		for (let x = 0; x < targetWidth; x += pixelsPerByte) {
			let byte = 0;
			const remainingPixels = Math.min(pixelsPerByte, targetWidth - x);

			for (let bit = 0; bit < remainingPixels; bit++) {
				const idx = yOffset + x + bit;
				byte |=
					paletteIndices[idx] << ((pixelsPerByte - 1 - bit) * bitsPerPixel);
			}

			buffer[destRowOffset + (x >> byteIndexShift)] = byte;
		}
	}
}

async function extractRgbData(
	image: sharp.Sharp,
	targetPixelCount: number,
): Promise<Uint8Array> {
	const { data, info } = await image
		.flatten({ background: { r: 255, g: 255, b: 255 } })
		.toColorspace("srgb")
		.raw()
		.toBuffer({ resolveWithObject: true });
	const rgbData = new Uint8Array(targetPixelCount * 3);

	for (let i = 0; i < targetPixelCount; i++) {
		const sourceOffset = i * info.channels;
		const targetOffset = i * 3;
		rgbData[targetOffset] = data[sourceOffset] as number;
		rgbData[targetOffset + 1] = data[sourceOffset + 1] as number;
		rgbData[targetOffset + 2] = data[sourceOffset + 2] as number;
	}

	return rgbData;
}

async function extractGrayscaleData(
	image: sharp.Sharp,
	targetPixelCount: number,
): Promise<Uint8Array> {
	const grayscaleImage = await image
		.grayscale()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const grayscaleData = new Uint8Array(targetPixelCount);

	for (let i = 0; i < targetPixelCount; i++) {
		grayscaleData[i] = grayscaleImage.data[i] as number;
	}

	return grayscaleData;
}

export async function renderBmp(png: Buffer, options: RenderBmpOptions = {}) {
	const {
		ditheringMethod = DitheringMethod.FLOYD_STEINBERG,
		inverted = false,
		grayscale = 2,
		palette,
		ditherPalette,
		applyEdgeSnap = true,
	} = options;

	const validLevels = [2, 4, 16, 256];
	if (!palette && !validLevels.includes(grayscale)) {
		throw new Error(
			`Invalid grayscale value: ${grayscale}. Must be one of: ${validLevels.join(", ")}`,
		);
	}

	const targetWidth = options.width ?? DEFAULT_IMAGE_WIDTH;
	const targetHeight = options.height ?? DEFAULT_IMAGE_HEIGHT;
	const targetPixelCount = targetWidth * targetHeight;

	const metadata = await sharp(png).metadata();
	const isDoubleSize =
		metadata.width === targetWidth * 2 && metadata.height === targetHeight * 2;

	let image = sharp(png);
	if (isDoubleSize) {
		image = image.resize(targetWidth, targetHeight, {
			kernel: sharp.kernel.nearest,
		});
	}

	const isColorPalette = palette !== undefined;
	const colorDitherPalette = isColorPalette
		? (ditherPalette ?? palette)
		: undefined;
	if (
		isColorPalette &&
		colorDitherPalette &&
		colorDitherPalette.length !== palette.length
	) {
		throw new Error("ditherPalette must match palette size");
	}

	if (!isColorPalette && grayscale === 256) {
		const { data } = await image
			.removeAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		const bitsPerPixel = 8;
		const numColors = 256;
		const paletteSize = numColors * 4;
		const fileHeaderSize = 14;
		const infoHeaderSize = 40;
		const rowSize = Math.floor((targetWidth * bitsPerPixel + 31) / 32) * 4;
		const headerSize = fileHeaderSize + infoHeaderSize + paletteSize;
		const fileSize = headerSize + rowSize * targetHeight;
		const buffer = Buffer.alloc(fileSize);

		buffer.write("BM", 0);
		buffer.writeUInt32LE(fileSize, 2);
		buffer.writeUInt32LE(0, 6);
		buffer.writeUInt32LE(headerSize, 10);
		buffer.writeUInt32LE(infoHeaderSize, 14);
		buffer.writeInt32LE(targetWidth, 18);
		buffer.writeInt32LE(targetHeight, 22);
		buffer.writeUInt16LE(1, 26);
		buffer.writeUInt16LE(bitsPerPixel, 28);
		buffer.writeUInt32LE(0, 30);
		buffer.writeUInt32LE(rowSize * targetHeight, 34);
		buffer.writeInt32LE(0, 38);
		buffer.writeInt32LE(0, 42);
		buffer.writeUInt32LE(numColors, 46);
		buffer.writeUInt32LE(numColors, 50);

		const paletteOffset = fileHeaderSize + infoHeaderSize;
		const paletteEntries = createIndexedColorPaletteEntries();
		for (const [index, paletteEntry] of paletteEntries.entries()) {
			buffer.writeUInt32LE(paletteEntry, paletteOffset + index * 4);
		}

		writeIndexed8BitmapRows({
			buffer,
			data,
			dataOffset: headerSize,
			rowSize,
			targetHeight,
			targetWidth,
		});

		return buffer;
	}

	const pixelData = isColorPalette
		? await extractRgbData(image, targetPixelCount)
		: await extractGrayscaleData(image, targetPixelCount);

	const dithered = isColorPalette
		? applyColorPaletteDithering(ditheringMethod, pixelData, {
				width: targetWidth,
				height: targetHeight,
				palette: colorDitherPalette ?? palette,
				applyEdgeSnap,
			})
		: applyDithering(ditheringMethod, pixelData, {
				width: targetWidth,
				height: targetHeight,
				levels: grayscale,
				applyEdgeSnap,
			});

	const numColors = isColorPalette ? palette.length : grayscale;
	const bitsPerPixel = isColorPalette
		? getBitsPerPixel(numColors)
		: grayscale === 2
			? 1
			: grayscale === 4
				? 2
				: 4;
	const paletteSize = numColors * 4;

	const fileHeaderSize = 14;
	const infoHeaderSize = 40;
	const rowSize = Math.floor((targetWidth * bitsPerPixel + 31) / 32) * 4;
	const headerSize = fileHeaderSize + infoHeaderSize + paletteSize;
	const fileSize = headerSize + rowSize * targetHeight;

	const buffer = Buffer.alloc(fileSize);

	buffer.write("BM", 0);
	buffer.writeUInt32LE(fileSize, 2);
	buffer.writeUInt32LE(0, 6);
	buffer.writeUInt32LE(headerSize, 10);

	buffer.writeUInt32LE(infoHeaderSize, 14);
	buffer.writeInt32LE(targetWidth, 18);
	buffer.writeInt32LE(targetHeight, 22);
	buffer.writeUInt16LE(1, 26);
	buffer.writeUInt16LE(bitsPerPixel, 28);
	buffer.writeUInt32LE(0, 30);
	buffer.writeUInt32LE(rowSize * targetHeight, 34);
	buffer.writeInt32LE(0, 38);
	buffer.writeInt32LE(0, 42);
	buffer.writeUInt32LE(numColors, 46);
	buffer.writeUInt32LE(numColors, 50);

	const paletteOffset = fileHeaderSize + infoHeaderSize;
	const paletteEntries = isColorPalette
		? createColorPaletteEntries(palette)
		: createGrayscalePaletteEntries(grayscale);
	for (const [index, paletteEntry] of paletteEntries.entries()) {
		buffer.writeUInt32LE(paletteEntry, paletteOffset + index * 4);
	}

	const dataOffset = headerSize;
	if (isColorPalette) {
		writePackedIndexedBitmapRows({
			buffer,
			dataOffset,
			paletteIndices: dithered,
			rowSize,
			targetHeight,
			targetWidth,
			bitsPerPixel,
		});
	} else {
		writePackedBitmapRows({
			buffer,
			dataOffset,
			dithered,
			grayscale,
			inverted,
			rowSize,
			targetHeight,
			targetWidth,
			bitsPerPixel,
		});
	}

	return buffer;
}
