import sharp from "sharp";
import { applyDithering, DitheringMethod } from "./image-processing";

export { DitheringMethod };

export interface RenderBmpOptions {
	ditheringMethod?: DitheringMethod;
	inverted?: boolean;
	width?: number;
	height?: number;
	grayscale?: number; // Number of gray levels: 2 (black/white), 4, or 16
	applyEdgeSnap?: boolean;
}

const createGrayscalePaletteEntries = (grayscale: number): number[] => {
	const paletteStep = 255 / (grayscale - 1);

	return Array.from({ length: grayscale }, (_, index) => {
		const grayValue = Math.round(index * paletteStep);
		return (grayValue << 16) | (grayValue << 8) | grayValue;
	});
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

function getPaletteIndex(
	value: number,
	grayscale: number,
	inverted: boolean,
): number {
	const paletteIndex = mapGrayscaleValueToPaletteIndex(value, grayscale);
	return inverted ? grayscale - 1 - paletteIndex : paletteIndex;
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
		// BMP is stored bottom-up
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

export async function renderBmp(png: Buffer, options: RenderBmpOptions = {}) {
	const {
		ditheringMethod = DitheringMethod.FLOYD_STEINBERG,
		inverted = false,
		grayscale = 2,
		applyEdgeSnap = true,
	} = options;

	// Validate grayscale levels
	const validLevels = [2, 4, 16];
	if (!validLevels.includes(grayscale)) {
		throw new Error(
			`Invalid grayscale value: ${grayscale}. Must be one of: ${validLevels.join(", ")}`,
		);
	}

	// Fixed dimensions to match the device requirements
	const targetWidth = options.width ?? 800;
	const targetHeight = options.height ?? 480;
	const targetPixelCount = targetWidth * targetHeight;

	// Load image metadata
	const metadata = await sharp(png).metadata();
	const isDoubleSize =
		metadata.width === targetWidth * 2 && metadata.height === targetHeight * 2;

	// Step 1: Resize to 800x480 if necessary
	let image = sharp(png);
	if (isDoubleSize) {
		image = image.resize(targetWidth, targetHeight, {
			kernel: sharp.kernel.nearest,
		});
	}

	const grayscaleImage = await image
		.grayscale()
		.raw()
		.toBuffer({ resolveWithObject: true });

	const { data } = grayscaleImage;

	// Step 2: Copy grayscale data
	const grayscaleData = new Uint8Array(targetPixelCount);
	for (let i = 0; i < targetPixelCount; i++) {
		grayscaleData[i] = data[i] as number;
	}

	// Step 3: Apply dithering with edge snapping
	const dithered = applyDithering(ditheringMethod, grayscaleData, {
		width: targetWidth,
		height: targetHeight,
		levels: grayscale,
		applyEdgeSnap,
	});

	// Determine BMP format based on grayscale levels
	const bitsPerPixel = grayscale === 2 ? 1 : grayscale === 4 ? 2 : 4;
	const numColors = grayscale;
	const paletteSize = numColors * 4; // Each color is 4 bytes (BGR + reserved)

	// BMP file header (14 bytes) + Info header (40 bytes)
	const fileHeaderSize = 14;
	const infoHeaderSize = 40;
	const rowSize = Math.floor((targetWidth * bitsPerPixel + 31) / 32) * 4;
	const headerSize = fileHeaderSize + infoHeaderSize + paletteSize;
	const fileSize = headerSize + rowSize * targetHeight;

	// Create a buffer of exactly the required size
	const buffer = Buffer.alloc(fileSize);

	// BMP File Header
	buffer.write("BM", 0); // Signature
	buffer.writeUInt32LE(fileSize, 2); // File Size
	buffer.writeUInt32LE(0, 6); // Reserved
	buffer.writeUInt32LE(fileHeaderSize + infoHeaderSize + paletteSize, 10); // Pixel data offset

	// BMP Info Header
	buffer.writeUInt32LE(infoHeaderSize, 14); // Info Header Size
	buffer.writeInt32LE(targetWidth, 18); // Width
	buffer.writeInt32LE(targetHeight, 22); // Height
	buffer.writeUInt16LE(1, 26); // Planes
	buffer.writeUInt16LE(bitsPerPixel, 28); // Bits per pixel
	buffer.writeUInt32LE(0, 30); // Compression
	buffer.writeUInt32LE(rowSize * targetHeight, 34); // Image Size
	buffer.writeInt32LE(0, 38); // X pixels per meter
	buffer.writeInt32LE(0, 42); // Y pixels per meter
	buffer.writeUInt32LE(numColors, 46); // Total Colors
	buffer.writeUInt32LE(numColors, 50); // Important Colors

	// Color palette entries are ordered from black to white so monochrome BMPs
	// match the device's expected pixel semantics.
	const paletteOffset = fileHeaderSize + infoHeaderSize;
	const paletteEntries = createGrayscalePaletteEntries(grayscale);
	for (const [index, paletteEntry] of paletteEntries.entries()) {
		buffer.writeUInt32LE(paletteEntry, paletteOffset + index * 4);
	}

	// Step 4: Generate the final bitmap
	const dataOffset = fileHeaderSize + infoHeaderSize + paletteSize;
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

	return buffer;
}
