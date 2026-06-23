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
