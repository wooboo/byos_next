/** Quantize a single pixel value to the nearest available gray level
 *  e.g. levels=2 → 0 or 255, levels=4 → 0, 85, 170, 256
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
type LinearRgbColor = readonly [red: number, green: number, blue: number];
type OklabColor = readonly [
	lightness: number,
	greenRed: number,
	blueYellow: number,
];

type PaletteColorProfile = {
	linear: LinearRgbColor;
	oklab: OklabColor;
};

type PaletteMatchProfile = {
	nominal: PaletteColorProfile[];
	display: PaletteColorProfile[];
	usesDisplayCalibration: boolean;
};

const DISPLAY_PALETTE_DISTANCE_WEIGHT = 0.8;
const NOMINAL_PALETTE_DISTANCE_WEIGHT = 0.2;
const OKLAB_CHROMA_DISTANCE_WEIGHT = 2;
const NOMINAL_COLOR_SNAP_TOLERANCE = 2;
const HIGHLIGHT_LUMINANCE_THRESHOLD = 218;
const HIGHLIGHT_NEUTRAL_CHROMA_LIMIT = 42;
const HIGHLIGHT_WHITE_MIN_LUMINANCE = 245;
const HIGHLIGHT_WHITE_MAX_CHROMA = 8;

const clampByte = (value: number): number =>
	Math.min(255, Math.max(0, Math.round(value)));

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value));

const srgbChannelToLinear = (channel: number): number => {
	const value = clampByte(channel) / 255;
	return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const rgbToLinear = (color: RgbColor): LinearRgbColor => [
	srgbChannelToLinear(color[0]),
	srgbChannelToLinear(color[1]),
	srgbChannelToLinear(color[2]),
];

const linearRgbToOklab = (color: LinearRgbColor): OklabColor => {
	const red = clampUnit(color[0]);
	const green = clampUnit(color[1]);
	const blue = clampUnit(color[2]);

	const l = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue;
	const m = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue;
	const s = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue;

	const lRoot = Math.cbrt(l);
	const mRoot = Math.cbrt(m);
	const sRoot = Math.cbrt(s);

	return [
		0.2104542553 * lRoot + 0.793617785 * mRoot - 0.0040720468 * sRoot,
		1.9779984951 * lRoot - 2.428592205 * mRoot + 0.4505937099 * sRoot,
		0.0259040371 * lRoot + 0.7827717662 * mRoot - 0.808675766 * sRoot,
	];
};

const rgbToOklab = (color: RgbColor): OklabColor =>
	linearRgbToOklab(rgbToLinear(color));

const bufferColorAt = (buffer: ArrayLike<number>, offset: number): RgbColor => [
	clampByte(buffer[offset] ?? 0),
	clampByte(buffer[offset + 1] ?? 0),
	clampByte(buffer[offset + 2] ?? 0),
];

const rgbLuminance = (color: RgbColor): number =>
	0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2];

const rgbChroma = (color: RgbColor): number =>
	Math.max(...color) - Math.min(...color);

const adjustColorSaturation = (
	color: RgbColor,
	colorSaturation = 1,
): RgbColor => {
	if (colorSaturation === 1) return color;

	const luminance = rgbLuminance(color);
	const safeSaturation = Math.max(0, colorSaturation);
	return [
		clampByte(luminance + (color[0] - luminance) * safeSaturation),
		clampByte(luminance + (color[1] - luminance) * safeSaturation),
		clampByte(luminance + (color[2] - luminance) * safeSaturation),
	];
};

const linearBufferColorAt = (
	buffer: ArrayLike<number>,
	offset: number,
): LinearRgbColor => [
	clampUnit(buffer[offset] ?? 0),
	clampUnit(buffer[offset + 1] ?? 0),
	clampUnit(buffer[offset + 2] ?? 0),
];

const findHighlightPaletteColor = (
	palette: RgbPalette,
): RgbColor | undefined => {
	let highlightColor: RgbColor | undefined;
	let highlightLuminance = Number.NEGATIVE_INFINITY;

	for (const color of palette) {
		const luminance = rgbLuminance(color);
		if (
			luminance >= HIGHLIGHT_WHITE_MIN_LUMINANCE &&
			rgbChroma(color) <= HIGHLIGHT_WHITE_MAX_CHROMA &&
			luminance > highlightLuminance
		) {
			highlightColor = color;
			highlightLuminance = luminance;
		}
	}

	return highlightColor;
};

const prepareColorDitheringSourcePixel = (
	color: RgbColor,
	palette: RgbPalette,
	displayPalette?: RgbPalette,
	colorSaturation = 1,
): RgbColor => {
	if (
		findNearDevicePaletteColorIndex(color, palette, displayPalette) !==
		undefined
	) {
		return color;
	}

	if (displayPalette) {
		const highlightColor = findHighlightPaletteColor(palette);
		if (
			highlightColor &&
			rgbLuminance(color) >= HIGHLIGHT_LUMINANCE_THRESHOLD &&
			rgbChroma(color) <= HIGHLIGHT_NEUTRAL_CHROMA_LIMIT
		) {
			return highlightColor;
		}
	}

	return adjustColorSaturation(color, colorSaturation);
};

const copyRgbToLinearBuffer = (
	rgb: Uint8Array,
	palette?: RgbPalette,
	displayPalette?: RgbPalette,
	colorSaturation = 1,
): Float32Array => {
	const buffer = new Float32Array(rgb.length);
	for (let offset = 0; offset < rgb.length; offset += 3) {
		const color = palette
			? prepareColorDitheringSourcePixel(
					bufferColorAt(rgb, offset),
					palette,
					displayPalette,
					colorSaturation,
				)
			: adjustColorSaturation(bufferColorAt(rgb, offset), colorSaturation);
		buffer[offset] = srgbChannelToLinear(color[0]);
		buffer[offset + 1] = srgbChannelToLinear(color[1]);
		buffer[offset + 2] = srgbChannelToLinear(color[2]);
	}
	return buffer;
};

const createPaletteColorProfiles = (
	palette: RgbPalette,
): PaletteColorProfile[] =>
	palette.map((color) => {
		const linear = rgbToLinear(color);
		return {
			linear,
			oklab: linearRgbToOklab(linear),
		};
	});

const createPaletteMatchProfile = (
	palette: RgbPalette,
	displayPalette?: RgbPalette,
): PaletteMatchProfile => {
	if (displayPalette && displayPalette.length !== palette.length) {
		throw new Error("displayPalette must match palette size");
	}

	return {
		nominal: createPaletteColorProfiles(palette),
		display: createPaletteColorProfiles(displayPalette ?? palette),
		usesDisplayCalibration:
			displayPalette !== undefined && displayPalette !== palette,
	};
};

const oklabDistance = (first: OklabColor, second: OklabColor): number => {
	const lightnessDelta = first[0] - second[0];
	const greenRedDelta = first[1] - second[1];
	const blueYellowDelta = first[2] - second[2];

	return (
		lightnessDelta * lightnessDelta +
		OKLAB_CHROMA_DISTANCE_WEIGHT *
			(greenRedDelta * greenRedDelta + blueYellowDelta * blueYellowDelta)
	);
};

const calibratedPaletteDistance = (
	color: OklabColor,
	paletteIndex: number,
	profile: PaletteMatchProfile,
): number => {
	const displayDistance = oklabDistance(
		color,
		profile.display[paletteIndex].oklab,
	);
	if (!profile.usesDisplayCalibration) return displayDistance;

	const nominalDistance = oklabDistance(
		color,
		profile.nominal[paletteIndex].oklab,
	);
	return (
		DISPLAY_PALETTE_DISTANCE_WEIGHT * displayDistance +
		NOMINAL_PALETTE_DISTANCE_WEIGHT * nominalDistance
	);
};

const findNearestPaletteColorIndexForProfile = (
	color: OklabColor,
	profile: PaletteMatchProfile,
): number => {
	let nearestIndex = 0;
	let nearestDistance = Number.POSITIVE_INFINITY;

	for (let index = 0; index < profile.display.length; index++) {
		const distance = calibratedPaletteDistance(color, index, profile);
		if (distance < nearestDistance) {
			nearestDistance = distance;
			nearestIndex = index;
		}
	}

	return nearestIndex;
};

const findNearPaletteColorIndex = (
	color: RgbColor,
	palette: RgbPalette,
): number | undefined => {
	for (let index = 0; index < palette.length; index++) {
		const paletteColor = palette[index];
		if (
			Math.abs(color[0] - paletteColor[0]) <= NOMINAL_COLOR_SNAP_TOLERANCE &&
			Math.abs(color[1] - paletteColor[1]) <= NOMINAL_COLOR_SNAP_TOLERANCE &&
			Math.abs(color[2] - paletteColor[2]) <= NOMINAL_COLOR_SNAP_TOLERANCE
		) {
			return index;
		}
	}

	return undefined;
};

const findNearDevicePaletteColorIndex = (
	color: RgbColor,
	palette: RgbPalette,
	displayPalette?: RgbPalette,
): number | undefined =>
	findNearPaletteColorIndex(color, palette) ??
	(displayPalette
		? findNearPaletteColorIndex(color, displayPalette)
		: undefined);

export const findNearestPaletteColorIndex = (
	color: RgbColor,
	palette: RgbPalette,
	displayPalette?: RgbPalette,
): number => {
	if (palette.length === 0) {
		throw new Error("palette must include at least one color");
	}

	const snappedPaletteIndex = findNearDevicePaletteColorIndex(
		color,
		palette,
		displayPalette,
	);
	if (snappedPaletteIndex !== undefined) return snappedPaletteIndex;

	return findNearestPaletteColorIndexForProfile(
		rgbToOklab(color),
		createPaletteMatchProfile(palette, displayPalette),
	);
};

export const quantizeRgbToPaletteIndices = (
	rgb: Uint8Array,
	palette: RgbPalette,
	displayPalette?: RgbPalette,
	colorSaturation = 1,
): Uint8Array => {
	const profile = createPaletteMatchProfile(palette, displayPalette);
	const result = new Uint8Array(rgb.length / 3);
	for (let pixel = 0; pixel < result.length; pixel++) {
		const sourcePixel = bufferColorAt(rgb, pixel * 3);
		const snappedPaletteIndex = findNearDevicePaletteColorIndex(
			sourcePixel,
			palette,
			displayPalette,
		);
		if (snappedPaletteIndex !== undefined) {
			result[pixel] = snappedPaletteIndex;
			continue;
		}

		const preparedSourcePixel = prepareColorDitheringSourcePixel(
			sourcePixel,
			palette,
			displayPalette,
			colorSaturation,
		);
		result[pixel] = findNearestPaletteColorIndexForProfile(
			rgbToOklab(preparedSourcePixel),
			profile,
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

const copyToFloatBuffer = (grayscale: Uint8Array): Float32Array => {
	const buffer = new Float32Array(grayscale.length);
	buffer.set(grayscale);
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
	displayPalette: RgbPalette | undefined,
	colorSaturation: number | undefined,
	kernel: readonly ErrorDiffusionOffset[],
	divisor: number,
): Uint8Array => {
	const result = new Uint8Array(width * height);
	const buffer = copyRgbToLinearBuffer(
		rgb,
		palette,
		displayPalette,
		colorSaturation,
	);
	const profile = createPaletteMatchProfile(palette, displayPalette);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const pixel = y * width + x;
			const offset = pixel * 3;
			const snappedPaletteIndex = findNearDevicePaletteColorIndex(
				bufferColorAt(rgb, offset),
				palette,
				displayPalette,
			);
			if (snappedPaletteIndex !== undefined) {
				result[pixel] = snappedPaletteIndex;
				continue;
			}

			const oldPixel = linearBufferColorAt(buffer, offset);
			const paletteIndex = findNearestPaletteColorIndexForProfile(
				linearRgbToOklab(oldPixel),
				profile,
			);
			const newPixel = profile.nominal[paletteIndex].linear;
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
): Uint8Array => {
	return ditherErrorDiffusion(
		grayscale,
		width,
		height,
		levels,
		FLOYD_STEINBERG_KERNEL,
		16,
	);
};

/** Atkinson error diffusion dithering */
export const ditherAtkinson = (
	grayscale: Uint8Array,
	width: number,
	height: number,
	levels = 2,
): Uint8Array => {
	return ditherErrorDiffusion(
		grayscale,
		width,
		height,
		levels,
		ATKINSON_KERNEL,
		8,
	);
};

/** Jarvis-Judice-Ninke error diffusion — smoother than Atkinson for photos */
const ditherJarvisJudiceNinke = (
	grayscale: Uint8Array,
	width: number,
	height: number,
	levels = 2,
): Uint8Array => {
	return ditherErrorDiffusion(
		grayscale,
		width,
		height,
		levels,
		JARVIS_JUDICE_NINKE_KERNEL,
		48,
	);
};

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
	displayPalette?: RgbPalette,
	colorSaturation?: number,
	patternSize = 8,
): Uint8Array => {
	const result = new Uint8Array(width * height);
	const profile = createPaletteMatchProfile(palette, displayPalette);
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
			const sourcePixel = prepareColorDitheringSourcePixel(
				bufferColorAt(rgb, offset),
				palette,
				displayPalette,
				colorSaturation,
			);
			result[pixel] = findNearestPaletteColorIndexForProfile(
				rgbToOklab([
					clampByte(sourcePixel[0] + threshold),
					clampByte(sourcePixel[1] + threshold),
					clampByte(sourcePixel[2] + threshold),
				]),
				profile,
			);
		}
	}

	return result;
};

const ditherRgbRandom = (
	rgb: Uint8Array,
	palette: RgbPalette,
	displayPalette?: RgbPalette,
	colorSaturation?: number,
): Uint8Array => {
	const result = new Uint8Array(rgb.length / 3);
	const profile = createPaletteMatchProfile(palette, displayPalette);

	for (let pixel = 0; pixel < result.length; pixel++) {
		const offset = pixel * 3;
		const sourcePixel = prepareColorDitheringSourcePixel(
			bufferColorAt(rgb, offset),
			palette,
			displayPalette,
			colorSaturation,
		);
		result[pixel] = findNearestPaletteColorIndexForProfile(
			rgbToOklab([
				clampByte(sourcePixel[0] + (Math.random() * 255 - 128)),
				clampByte(sourcePixel[1] + (Math.random() * 255 - 128)),
				clampByte(sourcePixel[2] + (Math.random() * 255 - 128)),
			]),
			profile,
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
	displayPalette?: RgbPalette,
	colorSaturation?: number,
): Uint8Array => {
	const result = new Uint8Array(dithered);
	const quantized = quantizeRgbToPaletteIndices(
		rgb,
		palette,
		displayPalette,
		colorSaturation,
	);
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
	displayPalette?: RgbPalette;
	colorSaturation?: number;
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
			options.displayPalette,
			options.colorSaturation,
			FLOYD_STEINBERG_KERNEL,
			16,
		),
	[DitheringMethod.ATKINSON]: (rgb, options, dimensions) =>
		ditherColorErrorDiffusion(
			rgb,
			dimensions.width,
			dimensions.height,
			options.palette,
			options.displayPalette,
			options.colorSaturation,
			ATKINSON_KERNEL,
			8,
		),
	[DitheringMethod.BAYER]: (rgb, options, dimensions) =>
		ditherRgbBayer(
			rgb,
			dimensions.width,
			dimensions.height,
			options.palette,
			options.displayPalette,
			options.colorSaturation,
			options.bayerPatternSize,
		),
	[DitheringMethod.RANDOM]: (rgb, options) =>
		ditherRgbRandom(
			rgb,
			options.palette,
			options.displayPalette,
			options.colorSaturation,
		),
	[DitheringMethod.JARVIS_JUDICE_NINKE]: (rgb, options, dimensions) =>
		ditherColorErrorDiffusion(
			rgb,
			dimensions.width,
			dimensions.height,
			options.palette,
			options.displayPalette,
			options.colorSaturation,
			JARVIS_JUDICE_NINKE_KERNEL,
			48,
		),
	[DitheringMethod.NONE]: (rgb, options) =>
		quantizeRgbToPaletteIndices(
			rgb,
			options.palette,
			options.displayPalette,
			options.colorSaturation,
		),
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
	if (width === undefined) {
		throw new Error(`width and height are required for ${method} dithering`);
	}
	if (height === undefined) {
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
		return applyColorEdgeSnap(
			rgb,
			result,
			edges,
			options.palette,
			options.displayPalette,
			options.colorSaturation,
		);
	}

	return result;
}
