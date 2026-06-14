import { DitheringMethod } from "@/utils/image-processing";

export const METHOD_MAP: Record<string, DitheringMethod> = {
	threshold: DitheringMethod.THRESHOLD,
	floydSteinberg: DitheringMethod.FLOYD_STEINBERG,
	atkinson: DitheringMethod.ATKINSON,
	bayer: DitheringMethod.BAYER,
	random: DitheringMethod.RANDOM,
};

export const resolveBayerPatternSize = (patternSize: number): 2 | 4 | 8 => {
	if (patternSize <= 2) return 2;
	if (patternSize <= 4) return 4;
	return 8;
};

export const resolveDitheringMethod = (methodName: string): DitheringMethod => {
	return METHOD_MAP[methodName] ?? DitheringMethod.FLOYD_STEINBERG;
};

export const preprocessImageData = (
	sourceData: Uint8ClampedArray,
	brightness: number,
	contrast: number,
): Uint8ClampedArray => {
	const processedData = new Uint8ClampedArray(sourceData);
	const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

	for (let i = 0; i < processedData.length; i += 4) {
		processedData[i] += brightness;
		processedData[i + 1] += brightness;
		processedData[i + 2] += brightness;

		processedData[i] = factor * (processedData[i] - 128) + 128;
		processedData[i + 1] = factor * (processedData[i + 1] - 128) + 128;
		processedData[i + 2] = factor * (processedData[i + 2] - 128) + 128;

		const gray =
			0.299 * processedData[i] +
			0.587 * processedData[i + 1] +
			0.114 * processedData[i + 2];
		processedData[i] = processedData[i + 1] = processedData[i + 2] = gray;
	}

	return processedData;
};

export const extractGrayscaleChannel = (
	processedData: Uint8ClampedArray,
): Uint8Array => {
	const grayscaleData = new Uint8Array(processedData.length / 4);

	for (let i = 0; i < grayscaleData.length; i++) {
		grayscaleData[i] = processedData[i * 4];
	}

	return grayscaleData;
};

export const applyDitheredValuesToImageData = (
	processedData: Uint8ClampedArray,
	dithered: Uint8Array,
	inverted: boolean,
): Uint8ClampedArray => {
	const nextData = new Uint8ClampedArray(processedData);

	for (let i = 0; i < dithered.length; i++) {
		const value = inverted ? 255 - dithered[i] : dithered[i];
		nextData[i * 4] = value;
		nextData[i * 4 + 1] = value;
		nextData[i * 4 + 2] = value;
	}

	return nextData;
};

export const buildBmpBuffer = (
	imageData: Uint8ClampedArray,
	width: number,
	height: number,
): ArrayBuffer => {
	const fileHeaderSize = 14;
	const dibHeaderSize = 40;
	const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
	const pixelArraySize = rowSize * height;
	const fileSize = fileHeaderSize + dibHeaderSize + pixelArraySize;
	const buffer = new ArrayBuffer(fileSize);
	const view = new DataView(buffer);

	view.setUint8(0, 0x42);
	view.setUint8(1, 0x4d);
	view.setUint32(2, fileSize, true);
	view.setUint16(6, 0, true);
	view.setUint16(8, 0, true);
	view.setUint32(10, fileHeaderSize + dibHeaderSize, true);

	view.setUint32(14, dibHeaderSize, true);
	view.setInt32(18, width, true);
	view.setInt32(22, -height, true);
	view.setUint16(26, 1, true);
	view.setUint16(28, 24, true);
	view.setUint32(30, 0, true);
	view.setUint32(34, pixelArraySize, true);
	view.setInt32(38, 2835, true);
	view.setInt32(42, 2835, true);
	view.setUint32(46, 0, true);
	view.setUint32(50, 0, true);

	let offset = fileHeaderSize + dibHeaderSize;

	for (let y = 0; y < height; y++) {
		let rowOffset = 0;

		for (let x = 0; x < width; x++) {
			const index = (y * width + x) * 4;
			view.setUint8(offset++, imageData[index + 2]);
			view.setUint8(offset++, imageData[index + 1]);
			view.setUint8(offset++, imageData[index]);
			rowOffset += 3;
		}

		while (rowOffset % 4 !== 0) {
			view.setUint8(offset++, 0);
			rowOffset++;
		}
	}

	return buffer;
};
