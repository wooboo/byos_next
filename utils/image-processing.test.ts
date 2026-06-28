import assert from "node:assert/strict";
import { it } from "vitest";
import {
	applyColorPaletteDithering,
	applyDithering,
	applyEdgeSnap,
	DitheringMethod,
	detectEdges,
	ditherAtkinson,
	ditherBayer,
	ditherFloydSteinberg,
	ditherRandom,
	ditherThreshold,
	findNearestPaletteColorIndex,
	quantize,
	quantizeRgbToPaletteIndices,
	quantizeValue,
} from "./image-processing.ts";

it("quantizeValue clamps to the nearest configured gray level", () => {
	assert.equal(quantizeValue(-20, 4), 0);
	assert.equal(quantizeValue(44, 4), 85);
	assert.equal(quantizeValue(129, 4), 170);
	assert.equal(quantizeValue(300, 4), 255);
});

it("quantize maps a grayscale buffer without changing its length", () => {
	const result = quantize(new Uint8Array([0, 40, 120, 200, 255]), 4);

	assert.deepEqual(Array.from(result), [0, 0, 85, 170, 255]);
});

it("maps RGB pixels to the nearest configured palette colors", () => {
	const palette = [
		[255, 0, 0],
		[0, 255, 0],
		[0, 0, 255],
		[255, 255, 0],
		[0, 0, 0],
		[255, 255, 255],
	] as const;

	assert.equal(findNearestPaletteColorIndex([245, 12, 10], palette), 0);

	const result = quantizeRgbToPaletteIndices(
		new Uint8Array([
			254, 10, 10, 10, 250, 10, 20, 20, 240, 245, 245, 20, 5, 5, 5, 250, 250,
			250,
		]),
		palette,
	);

	assert.deepEqual(Array.from(result), [0, 1, 2, 3, 4, 5]);
});

it("keeps calibrated display palettes anchored to nominal device colors", () => {
	const paperColorPalette = [
		[0, 0, 0],
		[255, 255, 255],
		[255, 243, 56],
		[191, 0, 0],
		[100, 64, 255],
		[67, 138, 28],
	] as const;
	const observedPaperColorPalette = [
		[87, 77, 80],
		[187, 189, 177],
		[178, 156, 55],
		[74, 35, 36],
		[38, 76, 137],
		[60, 102, 49],
	] as const;

	const result = applyColorPaletteDithering(
		DitheringMethod.NONE,
		new Uint8Array([0, 0, 0, 191, 0, 0, 87, 77, 80, 74, 35, 36]),
		{
			palette: paperColorPalette,
			displayPalette: observedPaperColorPalette,
		},
	);

	assert.deepEqual(Array.from(result), [0, 3, 0, 3]);
});

it("does not diffuse observed display error into flat nominal color fields", () => {
	const paperColorPalette = [
		[0, 0, 0],
		[255, 255, 255],
		[255, 243, 56],
		[191, 0, 0],
		[100, 64, 255],
		[67, 138, 28],
	] as const;
	const observedPaperColorPalette = [
		[87, 77, 80],
		[187, 189, 177],
		[178, 156, 55],
		[74, 35, 36],
		[38, 76, 137],
		[60, 102, 49],
	] as const;
	const rgb = new Uint8Array([
		0, 0, 0, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 243, 56, 255, 243, 56,
		191, 0, 0, 191, 0, 0, 100, 64, 255, 100, 64, 255, 67, 138, 28, 67, 138, 28,
	]);

	const result = applyColorPaletteDithering(
		DitheringMethod.JARVIS_JUDICE_NINKE,
		rgb,
		{
			width: 6,
			height: 2,
			palette: paperColorPalette,
			displayPalette: observedPaperColorPalette,
			applyEdgeSnap: false,
		},
	);

	assert.deepEqual(Array.from(result), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
});

it("keeps large near-nominal color fields solid during color error diffusion", () => {
	const paperColorPalette = [
		[0, 0, 0],
		[255, 255, 255],
		[255, 243, 56],
		[191, 0, 0],
		[100, 64, 255],
		[67, 138, 28],
	] as const;
	const observedPaperColorPalette = [
		[87, 77, 80],
		[187, 189, 177],
		[178, 156, 55],
		[74, 35, 36],
		[38, 76, 137],
		[60, 102, 49],
	] as const;
	const width = 300;
	const height = 180;
	const blockWidth = width / 3;
	const blockHeight = height / 2;
	const sourceColors = [
		[0, 0, 0],
		[255, 255, 255],
		[254, 243, 55],
		[190, 0, 0],
		[100, 65, 255],
		[66, 138, 28],
	] as const;
	const rgb = new Uint8Array(width * height * 3);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const colorIndex = (y < blockHeight ? 0 : 3) + Math.floor(x / blockWidth);
			const color = sourceColors[colorIndex];
			const offset = (y * width + x) * 3;
			rgb[offset] = color[0];
			rgb[offset + 1] = color[1];
			rgb[offset + 2] = color[2];
		}
	}

	const result = applyColorPaletteDithering(
		DitheringMethod.JARVIS_JUDICE_NINKE,
		rgb,
		{
			width,
			height,
			palette: paperColorPalette,
			displayPalette: observedPaperColorPalette,
			applyEdgeSnap: false,
		},
	);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const expectedIndex =
				(y < blockHeight ? 0 : 3) + Math.floor(x / blockWidth);
			assert.equal(result[y * width + x], expectedIndex);
		}
	}
});

it("preserves bright neutral highlights when using an observed color palette", () => {
	const paperColorPalette = [
		[0, 0, 0],
		[255, 255, 255],
		[255, 243, 56],
		[191, 0, 0],
		[100, 64, 255],
		[67, 138, 28],
	] as const;
	const observedPaperColorPalette = [
		[87, 77, 80],
		[187, 189, 177],
		[178, 156, 55],
		[74, 35, 36],
		[38, 76, 137],
		[60, 102, 49],
	] as const;
	const width = 24;
	const height = 24;
	const rgb = new Uint8Array(width * height * 3);

	for (let pixel = 0; pixel < width * height; pixel++) {
		const offset = pixel * 3;
		rgb[offset] = 225;
		rgb[offset + 1] = 224;
		rgb[offset + 2] = 211;
	}

	const result = applyColorPaletteDithering(DitheringMethod.ATKINSON, rgb, {
		width,
		height,
		palette: paperColorPalette,
		displayPalette: observedPaperColorPalette,
		applyEdgeSnap: false,
	});
	const histogram = Array.from(result).reduce((counts, paletteIndex) => {
		counts[paletteIndex] += 1;
		return counts;
	}, new Array(paperColorPalette.length).fill(0));

	assert.equal(histogram[0], 0);
	assert.equal(histogram[3], 0);
	assert.equal(histogram[4], 0);
	assert.equal(histogram[5], 0);
	assert.ok(histogram[1] / result.length > 0.8);
});

it("can boost color saturation before calibrated Bayer palette matching", () => {
	const paperColorPalette = [
		[0, 0, 0],
		[255, 255, 255],
		[255, 243, 56],
		[191, 0, 0],
		[100, 64, 255],
		[67, 138, 28],
	] as const;
	const observedPaperColorPalette = [
		[87, 77, 80],
		[187, 189, 177],
		[178, 156, 55],
		[74, 35, 36],
		[38, 76, 137],
		[60, 102, 49],
	] as const;
	const width = 256;
	const height = 8;
	const rgb = new Uint8Array(width * height * 3);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const ratio = x / (width - 1);
			const offset = (y * width + x) * 3;
			rgb[offset] = 255;
			rgb[offset + 1] = Math.round(255 + (243 - 255) * ratio);
			rgb[offset + 2] = Math.round(255 + (56 - 255) * ratio);
		}
	}

	const baseline = applyColorPaletteDithering(DitheringMethod.BAYER, rgb, {
		width,
		height,
		palette: paperColorPalette,
		displayPalette: observedPaperColorPalette,
		bayerPatternSize: 8,
		applyEdgeSnap: false,
	});
	const boosted = applyColorPaletteDithering(DitheringMethod.BAYER, rgb, {
		width,
		height,
		palette: paperColorPalette,
		displayPalette: observedPaperColorPalette,
		bayerPatternSize: 8,
		colorSaturation: 1.35,
		applyEdgeSnap: false,
	});
	const histogram = (indices: Uint8Array) =>
		Array.from(indices).reduce((counts, paletteIndex) => {
			counts[paletteIndex] += 1;
			return counts;
		}, new Array(paperColorPalette.length).fill(0));

	const baselineHistogram = histogram(baseline);
	const boostedHistogram = histogram(boosted);

	assert.ok(boostedHistogram[2] > baselineHistogram[2]);
	assert.ok(boostedHistogram[1] < baselineHistogram[1]);
});

it("threshold dithering does not require image dimensions", () => {
	const result = applyDithering(
		DitheringMethod.THRESHOLD,
		new Uint8Array([0, 127, 128, 255]),
		{ threshold: 128 },
	);

	assert.deepEqual(Array.from(result), [0, 0, 255, 255]);
});

it("dimension-dependent dithering rejects missing dimensions", () => {
	assert.throws(
		() =>
			applyDithering(DitheringMethod.FLOYD_STEINBERG, new Uint8Array([0, 255])),
		/width and height are required/,
	);

	assert.throws(
		() =>
			applyDithering(
				DitheringMethod.JARVIS_JUDICE_NINKE,
				new Uint8Array([0, 255]),
			),
		/width and height are required/,
	);
});

it("color palette error diffusion returns palette indices", () => {
	const result = applyColorPaletteDithering(
		DitheringMethod.FLOYD_STEINBERG,
		new Uint8Array([250, 0, 0, 250, 250, 250]),
		{
			width: 2,
			height: 1,
			palette: [
				[255, 0, 0],
				[255, 255, 255],
			],
		},
	);

	assert.deepEqual(Array.from(result), [0, 1]);
});

it("edge snap rejects missing dimensions even for dimensionless strategies", () => {
	assert.throws(
		() =>
			applyDithering(DitheringMethod.THRESHOLD, new Uint8Array([0, 255]), {
				applyEdgeSnap: true,
			}),
		/width and height are required/,
	);
});

it("applyDithering rejects unsupported Bayer pattern sizes", () => {
	assert.throws(
		() =>
			applyDithering(DitheringMethod.BAYER, new Uint8Array([0, 255]), {
				width: 1,
				height: 2,
				bayerPatternSize: 3 as 2,
			}),
		/bayerPatternSize must be 2, 4, or 8/,
	);
});

it("random dithering dispatches through DitheringMethod.RANDOM", () => {
	const originalRandom = Math.random;
	Math.random = () => 128 / 255;
	try {
		const result = applyDithering(
			DitheringMethod.RANDOM,
			new Uint8Array([0, 44, 129, 255]),
			{ levels: 4 },
		);

		assert.deepEqual(Array.from(result), [0, 85, 170, 255]);
	} finally {
		Math.random = originalRandom;
	}
});

it("none dithering quantizes without diffusion or noise", () => {
	const result = applyDithering(
		DitheringMethod.NONE,
		new Uint8Array([0, 44, 129, 255]),
		{ levels: 4 },
	);

	assert.deepEqual(Array.from(result), [0, 85, 170, 255]);
});

it("error diffusion strategies return quantized buffers with stable dimensions", () => {
	const grayscale = new Uint8Array([0, 64, 128, 255]);

	assert.deepEqual(
		Array.from(ditherFloydSteinberg(grayscale, 2, 2, 2)),
		[0, 0, 255, 255],
	);
	assert.deepEqual(
		Array.from(ditherAtkinson(grayscale, 2, 2, 2)),
		[0, 0, 255, 255],
	);
	assert.equal(
		applyDithering(DitheringMethod.JARVIS_JUDICE_NINKE, grayscale, {
			width: 2,
			height: 2,
		}).length,
		grayscale.length,
	);
	assert.equal(
		applyDithering(DitheringMethod.BAYER, grayscale, {
			width: 2,
			height: 2,
		}).length,
		grayscale.length,
	);
});

it("edge snap preserves crisp extreme pixels after dithering", () => {
	const grayscale = new Uint8Array([
		127, 127, 127, 127, 255, 127, 127, 127, 127,
	]);

	const edges = detectEdges(grayscale, 3, 3, 5);
	assert.deepEqual(Array.from(edges), [0, 0, 0, 0, 1, 0, 0, 0, 0]);

	const result = applyDithering(DitheringMethod.RANDOM, grayscale, {
		width: 3,
		height: 3,
		applyEdgeSnap: true,
	});

	assert.equal(result[4], 255);
});

it("detectEdges ignores border pixels and diagonal-only extremes", () => {
	const grayscale = new Uint8Array([0, 127, 127, 127, 127, 127, 127, 127, 255]);

	const edges = detectEdges(grayscale, 3, 3, 5);

	assert.deepEqual(Array.from(edges), [0, 0, 0, 0, 0, 0, 0, 0, 0]);
});

it("detectEdges marks cardinal neighbors near black or white", () => {
	const grayscale = new Uint8Array([
		127, 255, 127, 127, 127, 127, 127, 127, 127,
	]);

	const edges = detectEdges(grayscale, 3, 3, 5);

	assert.equal(edges[4], 1);
});

it("detectEdges respects fuzziness threshold", () => {
	const grayscale = new Uint8Array([
		127, 236, 127, 127, 127, 127, 127, 127, 127,
	]);

	assert.equal(detectEdges(grayscale, 3, 3, 10)[4], 0);
	assert.equal(detectEdges(grayscale, 3, 3, 20)[4], 1);
});

it("ditherBayer selects stable matrices without changing output length", () => {
	const grayscale = new Uint8Array([64, 128, 192, 255]);

	assert.deepEqual(
		Array.from(ditherBayer(grayscale, 2, 2, 2, 2)),
		[0, 0, 255, 255],
	);
	assert.deepEqual(
		Array.from(ditherBayer(grayscale, 2, 2, 2, 4)),
		[0, 0, 255, 255],
	);
	assert.equal(ditherBayer(grayscale, 2, 2, 2, 8).length, grayscale.length);
});

it("ditherThreshold keeps values below threshold black", () => {
	const result = ditherThreshold(new Uint8Array([64, 65]), 65);

	assert.deepEqual(Array.from(result), [0, 255]);
});

it("applyEdgeSnap only replaces pixels marked as edges", () => {
	const result = applyEdgeSnap(
		new Uint8Array([20, 130, 200]),
		new Uint8Array([0, 0, 255]),
		new Uint8Array([1, 0, 1]),
		4,
	);

	assert.deepEqual(Array.from(result), [0, 0, 170]);
});

it("detectEdges marks the center pixel when it is itself near an extreme", () => {
	const grayscale = new Uint8Array([
		127, 127, 127, 127, 250, 127, 127, 127, 127,
	]);

	assert.deepEqual(
		Array.from(detectEdges(grayscale, 3, 3, 10)),
		[0, 0, 0, 0, 1, 0, 0, 0, 0],
	);
});

it("bayer dithering resolves pattern sizes to the expected matrix buckets", () => {
	const grayscale = new Uint8Array([64, 128, 192, 255]);

	assert.deepEqual(
		Array.from(ditherBayer(grayscale, 2, 2, 2, 1)),
		Array.from(ditherBayer(grayscale, 2, 2, 2, 2)),
	);
	assert.deepEqual(
		Array.from(ditherBayer(grayscale, 2, 2, 2, 3)),
		Array.from(ditherBayer(grayscale, 2, 2, 2, 4)),
	);
	assert.deepEqual(
		Array.from(ditherBayer(grayscale, 2, 2, 2, 5)),
		Array.from(ditherBayer(grayscale, 2, 2, 2, 8)),
	);
});

it("random dithering clamps noisy values back into the configured palette", () => {
	const originalRandom = Math.random;
	try {
		Math.random = () => 0;
		assert.deepEqual(
			Array.from(ditherRandom(new Uint8Array([0, 255]), 4)),
			[0, 85],
		);

		Math.random = () => 1;
		assert.deepEqual(
			Array.from(ditherRandom(new Uint8Array([0, 255]), 4)),
			[85, 255],
		);
	} finally {
		Math.random = originalRandom;
	}
});
