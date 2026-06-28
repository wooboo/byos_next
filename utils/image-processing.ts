/** Quantize a single pixel value to the nearest available gray level
 *  e.g. levels=2 -> 0 or 255, levels=4 -> 0, 85, 170, 255
 **/
export const quantizeValue = (value: number, levels: number): number => {
	const step = 255 / (levels - 1);
	const quantized = Math.round(value / step) * step;
	return Math.min(255, Math.max(0, quantized));
};

/** Quantize each pixel to the nearest gray level with no dithering */
export const quantize = (grayscale: Uint8Array, levels = 2): Uint8Array => {
	const result = new Uint8Array(grayscale.length);
	for (let i = 0; i < grayscale.length; i++) {
		result[i] = quantizeValue(grayscale[i], levels);
	}
	return result;
};

export type RgbColor = readonly [red: number, green: number, blue: number];
export type RgbPalette = readonly RgbColor[];

const clampByte = (value: number): number =>
	Math.min(255, Math.max(0, Math.round(value)));

const colorDistance = (first: RgbColor, second: RgbColor): number => {
	const redMean = (first[0] + second[0]) / 2;
	const redDelta = first[0] - second[0];
	const greenDelta = first[1] - second[1];
	const blueDelta = first[2] - second[2];

	return (
		(2 + redMean / 256) * redDelta * redDelta +
		4 * greenDelta * greenDelta +
		(2 + (255 - redMean) / 256) * blueDelta * blueDelta
	);
};

const bufferColorAt = (buffer: ArrayLike<number>, offset: number): RgbColor => [
	clampByte(buffer[offset] ?? 0),
	clampByte(buffer[offset + 1] ?? 0),
	clampByte(buffer[offset + 2] ?? 0),
];

export const findNearestPaletteColorIndex = (
	color: RgbColor,
	palette: RgbPalette,
): number => {
	if (palette.length === 0) {
		throw new Error("palette must include at least one color");
	}

	let nearestIndex = 0;
	let nearestDistance = Number.POSITIVE_INFINITY;

	for (let index = 0; index < palette.length; index++) {
		const distance = colorDistance(color, palette[index]);
		if (distance < nearestDistance) {
			nearestDistance = distance;
			nearestIndex = index;
		}
	}

	return nearestIndex;
};

export const quantizeRgbToPaletteIndices = (
	rgb: Uint8Array,
	palette: RgbPalette,
): Uint8Array => {
	const result = new Uint8Array(rgb.length / 3);
	for (let pixel = 0; pixel < result.length; pixel++) {
		result[pixel] = findNearestPaletteColorIndex(
			bufferColorAt(rgb, pixel * 3),
			palette,
		);
	}
	return result;
};

/** Simple threshold dithering. Pixels below threshold map to black, at or above to white. */
export const ditherThreshold = (
	grayscale: Uint8Array,
	threshold = 128,
): Uint8Array => {
	const result = new Uint8Array(grayscale.length);
	for (let i = 0; i < grayscale.length; i++) {
		result[i] = grayscale[i] < threshold ? 0 : 255;
	}
	return result;
};

type ErrorDiffusionOffset = readonly [dx: number, dy: number, weight: number];

const FLOYD_STEINBERG_KERNEL: readonly ErrorDiffusionOffset[] = [
	[1, 0, 7],
	[-1, 1, 3],
	[0, 1, 5],
	[1, 1, 1],
];

const ATKINSON_KERNEL: readonly ErrorDiffusionOffset[] = [
	[1, 0, 1],
	[2, 0, 1],
	[-1, 1, 1],
	[0, 1, 1],
	[1, 1, 1],
	[0, 2, 1],
];

const JARVIS_JUDICE_NINKE_KERNEL: readonly ErrorDiffusionOffset[] = [
	[1, 0, 7],
	[2, 0, 5],
	[-2, 1, 3],
	[-1, 1, 5],
	[0, 1, 7],
	[1, 1, 5],
	[2, 1, 3],
	[-2, 2, 1],
	[-1, 2, 3],
	[0, 2, 5],
	[1, 2, 3],
	[2, 2, 1],
];

const copyToFloatBuffer = (data: Uint8Array): Float32Array => {
	const buffer = new Float32Array(data.length);
	buffer.set(data);
	return buffer;
};

const spreadError = (
	buffer: Float32Array,
	width: number,
	height: number,
	x: number,
	y: number,
	error: number,
	kernel: readonly ErrorDiffusionOffset[],
	divisor: number,
) => {
	for (const [dx, dy, weight] of kernel) {
		const targetX = x + dx;
		const targetY = y + dy;
		if (targetX >>> 0 >= width || targetY >>> 0 >= height) continue;
		buffer[targetY * width + targetX] += (error * weight) / divisor;
	}
};

const spreadColorError = (
	buffer: Float32Array,
	width: number,
	height: number,
	x: number,
	y: number,
	error: RgbColor,
	kernel: readonly ErrorDiffusionOffset[],
	divisor: number,
) => {
	for (const [dx, dy, weight] of kernel) {
		const targetX = x + dx;
		const targetY = y + dy;
		if (targetX >>> 0 >= width || targetY >>> 0 >= height) continue;

		const targetOffset = (targetY * width + targetX) * 3;
		buffer[targetOffset] += (error[0] * weight) / divisor;
		buffer[targetOffset + 1] += (error[1] * weight) / divisor;
		buffer[targetOffset + 2] += (error[2] * weight) / divisor;
	}
};

const ditherErrorDiffusion = (
	grayscale: Uint8Array,
	width: number,
	height: number,
	levels: number,
	kernel: readonly ErrorDiffusionOffset[],
	divisor: number,
): Uint8Array => {
	const result = new Uint8Array(grayscale.length);
	const buffer = copyToFloatBuffer(grayscale);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const index = y * width + x;
			const oldPixel = buffer[index];
			const newPixel = quantizeValue(oldPixel, levels);
			result[index] = newPixel;
			spreadError(
				buffer,
				width,
				height,
				x,
				y,
				oldPixel - newPixel,
				kernel,
				divisor,
			);
		}
	}

	return result;
};

const ditherColorErrorDiffusion = (
	rgb: Uint8Array,
	width: number,
	height: number,
	palette: RgbPalette,
	kernel: readonly ErrorDiffusionOffset[],
	divisor: number,
): Uint8Array => {
	const result = new Uint8Array(width * height);
	const buffer = copyToFloatBuffer(rgb);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const pixel = y * width + x;
			const offset = pixel * 3;
			const oldPixel = bufferColorAt(buffer, offset);
			const paletteIndex = findNearestPaletteColorIndex(oldPixel, palette);
			const newPixel = palette[paletteIndex];
			result[pixel] = paletteIndex;
			spreadColorError(
				buffer,
				width,
				height,
				x,
				y,
				[
					buffer[offset] - newPixel[0],
					buffer[offset + 1] - newPixel[1],
					buffer[offset + 2] - newPixel[2],
				],
				kernel,
				divisor,
			);
		}
	}

	return result;
};

/** Floyd-Steinberg error diffusion dithering */
export const ditherFloydSteinberg = (
	grayscale: Uint8Array,
	width: number,
	height: number,
	levels = 2,
): Uint8Array =>
	ditherErrorDiffusion(
		grayscale,
		width,
		height,
		levels,
		FLOYD_STEINBERG_KERNEL,
		16,
	);

/** Atkinson error diffusion dithering */
export const ditherAtkinson = (
	grayscale: Uint8Array,
	width: number,
	height: number,
	levels = 2,
): Uint8Array =>
	ditherErrorDiffusion(grayscale, width, height, levels, ATKINSON_KERNEL, 8);

/** Jarvis-Judice-Ninke error diffusion, smoother than Atkinson for photos. */
const ditherJarvisJudiceNinke = (
	grayscale: Uint8Array,
	width: number,
	height: number,
	levels = 2,
): Uint8Array =>
	ditherErrorDiffusion(
		grayscale,
		width,
		height,
		levels,
		JARVIS_JUDICE_NINKE_KERNEL,
		48,
	);

const BAYER_MATRICES: Record<number, number[][]> = {
	2: [
		[0, 2],
		[3, 1],
	],
	4: [
		[0, 8, 2, 10],
		[12, 4, 14, 6],
		[3, 11, 1, 9],
		[15, 7, 13, 5],
	],
	8: [
		[0, 32, 8, 40, 2, 34, 10, 42],
		[48, 16, 56, 24, 50, 18, 58, 26],
		[12, 44, 4, 36, 14, 46, 6, 38],
		[60, 28, 52, 20, 62, 30, 54, 22],
		[3, 35, 11, 43, 1, 33, 9, 41],
		[51, 19, 59, 27, 49, 17, 57, 25],
		[15, 47, 7, 39, 13, 45, 5, 37],
		[63, 31, 55, 23, 61, 29, 53, 21],
	],
};

const resolveBayerMatrixSize = (patternSize: number): 2 | 4 | 8 => {
	if (patternSize <= 2) return 2;
	if (patternSize <= 4) return 4;
	return 8;
};

const normalizeBayerMatrix = (matrix: number[][]): number[][] => {
	const matrixLength = matrix.length;
	return matrix.map((row) =>
		row.map((val) => Math.floor((val * 255) / (matrixLength * matrixLength))),
	);
};

/** Bayer ordered dithering. patternSize selects the matrix: 2, 4, or 8 */
export const ditherBayer = (
	grayscale: Uint8Array,
	width: number,
	height: number,
	levels = 2,
	patternSize = 8,
): Uint8Array => {
	const result = new Uint8Array(grayscale.length);

	const matrixSize = resolveBayerMatrixSize(patternSize);
	const matrix = BAYER_MATRICES[matrixSize];
	const matrixLength = matrix.length;
	const normalizedMatrix = normalizeBayerMatrix(matrix);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const index = y * width + x;
			const gray = grayscale[index];
			const threshold = normalizedMatrix[y % matrixLength][x % matrixLength];
			const adjustedValue = gray + (threshold - 128);
			result[index] = quantizeValue(adjustedValue, levels);
		}
	}

	return result;
};

/** Random noise dithering */
export const ditherRandom = (grayscale: Uint8Array, levels = 2): Uint8Array => {
	const result = new Uint8Array(grayscale.length);

	for (let i = 0; i < grayscale.length; i++) {
		const adjustedValue = grayscale[i] + (Math.random() * 255 - 128);
		result[i] = quantizeValue(adjustedValue, levels);
	}

	return result;
};

const ditherRgbBayer = (
	rgb: Uint8Array,
	width: number,
	height: number,
	palette: RgbPalette,
	patternSize = 8,
): Uint8Array => {
	const result = new Uint8Array(width * height);
	const matrixSize = resolveBayerMatrixSize(patternSize);
	const matrix = BAYER_MATRICES[matrixSize];
	const matrixLength = matrix.length;
	const normalizedMatrix = normalizeBayerMatrix(matrix);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const pixel = y * width + x;
			const offset = pixel * 3;
			const threshold =
				normalizedMatrix[y % matrixLength][x % matrixLength] - 128;
			result[pixel] = findNearestPaletteColorIndex(
				[
					clampByte(rgb[offset] + threshold),
					clampByte(rgb[offset + 1] + threshold),
					clampByte(rgb[offset + 2] + threshold),
				],
				palette,
			);
		}
	}

	return result;
};

const ditherRgbRandom = (rgb: Uint8Array, palette: RgbPalette): Uint8Array => {
	const result = new Uint8Array(rgb.length / 3);

	for (let pixel = 0; pixel < result.length; pixel++) {
		const offset = pixel * 3;
		result[pixel] = findNearestPaletteColorIndex(
			[
				clampByte(rgb[offset] + (Math.random() * 255 - 128)),
				clampByte(rgb[offset + 1] + (Math.random() * 255 - 128)),
				clampByte(rgb[offset + 2] + (Math.random() * 255 - 128)),
			],
			palette,
		);
	}

	return result;
};

const rgbToLuminance = (rgb: Uint8Array): Uint8Array => {
	const result = new Uint8Array(rgb.length / 3);
	for (let pixel = 0; pixel < result.length; pixel++) {
		const offset = pixel * 3;
		result[pixel] = clampByte(
			0.299 * rgb[offset] + 0.587 * rgb[offset + 1] + 0.114 * rgb[offset + 2],
		);
	}
	return result;
};

const applyColorEdgeSnap = (
	rgb: Uint8Array,
	dithered: Uint8Array,
	edges: Uint8Array,
	palette: RgbPalette,
): Uint8Array => {
	const result = new Uint8Array(dithered);
	const quantized = quantizeRgbToPaletteIndices(rgb, palette);
	for (let i = 0; i < result.length; i++) {
		if (edges[i]) result[i] = quantized[i];
	}
	return result;
};

const EDGE_NEIGHBOR_OFFSETS = [0, -1, 1] as const;

const isExtremeValue = (value: number, fuzziness: number, limit: number) =>
	value < fuzziness || value > limit;

const hasExtremeHorizontalNeighbor = (
	grayscale: Uint8Array,
	idx: number,
	fuzziness: number,
	limit: number,
) =>
	EDGE_NEIGHBOR_OFFSETS.some((offset) =>
		isExtremeValue(grayscale[idx + offset], fuzziness, limit),
	);

const hasExtremeVerticalNeighbor = (
	grayscale: Uint8Array,
	idx: number,
	width: number,
	fuzziness: number,
	limit: number,
) =>
	[-width, width].some((offset) =>
		isExtremeValue(grayscale[idx + offset], fuzziness, limit),
	);

const hasExtremeEdgeSample = (
	grayscale: Uint8Array,
	idx: number,
	width: number,
	fuzziness: number,
	limit: number,
) =>
	hasExtremeHorizontalNeighbor(grayscale, idx, fuzziness, limit) ||
	hasExtremeVerticalNeighbor(grayscale, idx, width, fuzziness, limit);

/** Detect edge pixels by checking if a pixel or any 4-directional neighbor is near pure black or white.
 *  Returns a Uint8Array where 1 = edge pixel, 0 = non-edge. Border pixels are always 0. */
export const detectEdges = (
	grayscale: Uint8Array,
	width: number,
	height: number,
	fuzziness = 20,
): Uint8Array => {
	const result = new Uint8Array(grayscale.length);
	const limit = 255 - fuzziness;

	for (let y = 1; y < height - 1; y++) {
		for (let x = 1; x < width - 1; x++) {
			const idx = y * width + x;
			result[idx] = hasExtremeEdgeSample(
				grayscale,
				idx,
				width,
				fuzziness,
				limit,
			)
				? 1
				: 0;
		}
	}

	return result;
};

/** For edge pixels, snap to the nearest quantized level instead of using the dithered value.
 *  Non-edge pixels pass through unchanged from the dithered input. */
export const applyEdgeSnap = (
	grayscale: Uint8Array,
	dithered: Uint8Array,
	edges: Uint8Array,
	levels = 2,
): Uint8Array => {
	const result = new Uint8Array(grayscale.length);
	for (let i = 0; i < grayscale.length; i++) {
		result[i] = edges[i] ? quantizeValue(grayscale[i], levels) : dithered[i];
	}
	return result;
};

export enum DitheringMethod {
	THRESHOLD = "threshold",
	FLOYD_STEINBERG = "floyd-steinberg",
	ATKINSON = "atkinson",
	BAYER = "bayer",
	RANDOM = "random",
	JARVIS_JUDICE_NINKE = "jarvis-judice-ninke",
	NONE = "none",
}

export interface DitheringOptions {
	width?: number;
	height?: number;
	levels?: number;
	threshold?: number;
	applyEdgeSnap?: boolean;
	edgeDetectionFuzziness?: number;
	bayerPatternSize?: 2 | 4 | 8;
}

type ResolvedDimensions = {
	width: number;
	height: number;
};

type DitheringStrategy = (
	grayscale: Uint8Array,
	options: DitheringOptions,
	dimensions: ResolvedDimensions,
) => Uint8Array;

type ColorDitheringStrategy = (
	rgb: Uint8Array,
	options: ColorDitheringOptions,
	dimensions: ResolvedDimensions,
) => Uint8Array;

const EMPTY_DIMENSIONS: ResolvedDimensions = { width: 0, height: 0 };

const DIMENSIONAL_METHODS = new Set<DitheringMethod>([
	DitheringMethod.FLOYD_STEINBERG,
	DitheringMethod.ATKINSON,
	DitheringMethod.BAYER,
	DitheringMethod.JARVIS_JUDICE_NINKE,
]);

const DITHERING_STRATEGIES: Record<DitheringMethod, DitheringStrategy> = {
	[DitheringMethod.THRESHOLD]: (grayscale, options) =>
		ditherThreshold(grayscale, options.threshold),
	[DitheringMethod.FLOYD_STEINBERG]: (grayscale, options, dimensions) =>
		ditherFloydSteinberg(
			grayscale,
			dimensions.width,
			dimensions.height,
			options.levels,
		),
	[DitheringMethod.ATKINSON]: (grayscale, options, dimensions) =>
		ditherAtkinson(
			grayscale,
			dimensions.width,
			dimensions.height,
			options.levels,
		),
	[DitheringMethod.BAYER]: (grayscale, options, dimensions) =>
		ditherBayer(
			grayscale,
			dimensions.width,
			dimensions.height,
			options.levels,
			options.bayerPatternSize,
		),
	[DitheringMethod.RANDOM]: (grayscale, options) =>
		ditherRandom(grayscale, options.levels),
	[DitheringMethod.JARVIS_JUDICE_NINKE]: (grayscale, options, dimensions) =>
		ditherJarvisJudiceNinke(
			grayscale,
			dimensions.width,
			dimensions.height,
			options.levels,
		),
	[DitheringMethod.NONE]: (grayscale, options) =>
		quantize(grayscale, options.levels),
};

export interface ColorDitheringOptions
	extends Omit<DitheringOptions, "levels" | "threshold"> {
	palette: RgbPalette;
}

const COLOR_DITHERING_STRATEGIES: Record<
	DitheringMethod,
	ColorDitheringStrategy
> = {
	[DitheringMethod.THRESHOLD]: (rgb, options) =>
		quantizeRgbToPaletteIndices(rgb, options.palette),
	[DitheringMethod.FLOYD_STEINBERG]: (rgb, options, dimensions) =>
		ditherColorErrorDiffusion(
			rgb,
			dimensions.width,
			dimensions.height,
			options.palette,
			FLOYD_STEINBERG_KERNEL,
			16,
		),
	[DitheringMethod.ATKINSON]: (rgb, options, dimensions) =>
		ditherColorErrorDiffusion(
			rgb,
			dimensions.width,
			dimensions.height,
			options.palette,
			ATKINSON_KERNEL,
			8,
		),
	[DitheringMethod.BAYER]: (rgb, options, dimensions) =>
		ditherRgbBayer(
			rgb,
			dimensions.width,
			dimensions.height,
			options.palette,
			options.bayerPatternSize,
		),
	[DitheringMethod.RANDOM]: (rgb, options) =>
		ditherRgbRandom(rgb, options.palette),
	[DitheringMethod.JARVIS_JUDICE_NINKE]: (rgb, options, dimensions) =>
		ditherColorErrorDiffusion(
			rgb,
			dimensions.width,
			dimensions.height,
			options.palette,
			JARVIS_JUDICE_NINKE_KERNEL,
			48,
		),
	[DitheringMethod.NONE]: (rgb, options) =>
		quantizeRgbToPaletteIndices(rgb, options.palette),
};

const assertValidBayerPatternSize = (bayerPatternSize?: number) => {
	if (bayerPatternSize !== undefined && ![2, 4, 8].includes(bayerPatternSize)) {
		throw new Error("bayerPatternSize must be 2, 4, or 8");
	}
};

const requireDimensions = (
	method: DitheringMethod,
	options: DitheringOptions,
): ResolvedDimensions => {
	const { width, height } = options;
	if (width === undefined || height === undefined) {
		throw new Error(`width and height are required for ${method} dithering`);
	}
	return { width, height };
};

const resolveDimensions = (
	method: DitheringMethod,
	options: DitheringOptions,
): ResolvedDimensions | undefined => {
	if (DIMENSIONAL_METHODS.has(method))
		return requireDimensions(method, options);
	if (options.applyEdgeSnap === true) return requireDimensions(method, options);
	return undefined;
};

export function applyDithering(
	method: DitheringMethod,
	grayscale: Uint8Array,
	options: DitheringOptions = {},
): Uint8Array {
	assertValidBayerPatternSize(options.bayerPatternSize);
	const dimensions = resolveDimensions(method, options) ?? EMPTY_DIMENSIONS;
	const result = DITHERING_STRATEGIES[method](grayscale, options, dimensions);

	if (options.applyEdgeSnap) {
		const edges = detectEdges(
			grayscale,
			dimensions.width,
			dimensions.height,
			options.edgeDetectionFuzziness,
		);
		return applyEdgeSnap(grayscale, result, edges, options.levels);
	}

	return result;
}

export function applyColorPaletteDithering(
	method: DitheringMethod,
	rgb: Uint8Array,
	options: ColorDitheringOptions,
): Uint8Array {
	if (rgb.length % 3 !== 0) {
		throw new Error("rgb buffer length must be divisible by 3");
	}

	assertValidBayerPatternSize(options.bayerPatternSize);
	const dimensions = resolveDimensions(method, options) ?? EMPTY_DIMENSIONS;
	const result = COLOR_DITHERING_STRATEGIES[method](rgb, options, dimensions);

	if (options.applyEdgeSnap) {
		const luminance = rgbToLuminance(rgb);
		const edges = detectEdges(
			luminance,
			dimensions.width,
			dimensions.height,
			options.edgeDetectionFuzziness,
		);
		return applyColorEdgeSnap(rgb, result, edges, options.palette);
	}

	return result;
}
