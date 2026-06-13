import assert from "node:assert/strict";
import test from "node:test";
import {
	applyDithering,
	DitheringMethod,
	detectEdges,
	ditherBayer,
	ditherThreshold,
	quantize,
	quantizeValue,
} from "../utils/image-processing.ts";

test("quantizeValue clamps to the nearest configured gray level", () => {
	assert.equal(quantizeValue(-20, 4), 0);
	assert.equal(quantizeValue(44, 4), 85);
	assert.equal(quantizeValue(129, 4), 170);
	assert.equal(quantizeValue(300, 4), 255);
});

test("quantize maps a grayscale buffer without changing its length", () => {
	const result = quantize(new Uint8Array([0, 40, 120, 200, 255]), 4);

	assert.deepEqual(Array.from(result), [0, 0, 85, 170, 255]);
});

test("threshold dithering does not require image dimensions", () => {
	const result = applyDithering(
		DitheringMethod.THRESHOLD,
		new Uint8Array([0, 127, 128, 255]),
		{ threshold: 128 },
	);

	assert.deepEqual(Array.from(result), [0, 0, 255, 255]);
});

test("dimension-dependent dithering rejects missing dimensions", () => {
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

test("random dithering dispatches through DitheringMethod.RANDOM", () => {
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

test("edge snap preserves crisp extreme pixels after dithering", () => {
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

test("detectEdges ignores border pixels and diagonal-only extremes", () => {
	const grayscale = new Uint8Array([0, 127, 127, 127, 127, 127, 127, 127, 255]);

	const edges = detectEdges(grayscale, 3, 3, 5);

	assert.deepEqual(Array.from(edges), [0, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test("detectEdges marks cardinal neighbors near black or white", () => {
	const grayscale = new Uint8Array([
		127, 255, 127, 127, 127, 127, 127, 127, 127,
	]);

	const edges = detectEdges(grayscale, 3, 3, 5);

	assert.equal(edges[4], 1);
});

test("detectEdges respects fuzziness threshold", () => {
	const grayscale = new Uint8Array([
		127, 236, 127, 127, 127, 127, 127, 127, 127,
	]);

	assert.equal(detectEdges(grayscale, 3, 3, 10)[4], 0);
	assert.equal(detectEdges(grayscale, 3, 3, 20)[4], 1);
});

test("ditherBayer selects stable matrices without changing output length", () => {
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

test("ditherThreshold keeps values below threshold black", () => {
	const result = ditherThreshold(new Uint8Array([64, 65]), 65);

	assert.deepEqual(Array.from(result), [0, 255]);
});
