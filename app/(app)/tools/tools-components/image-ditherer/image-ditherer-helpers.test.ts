import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { DitheringMethod } from "@/utils/image-processing";
import {
	applyDitheredValuesToImageData,
	buildBmpBuffer,
	extractGrayscaleChannel,
	preprocessImageData,
	resolveBayerPatternSize,
	resolveDitheringMethod,
} from "./image-ditherer-helpers.ts";

describe("image-ditherer helpers", () => {
	it("resolves supported dithering methods and Bayer sizes", () => {
		assert.equal(
			resolveDitheringMethod("threshold"),
			DitheringMethod.THRESHOLD,
		);
		assert.equal(
			resolveDitheringMethod("unknown"),
			DitheringMethod.FLOYD_STEINBERG,
		);
		assert.equal(resolveBayerPatternSize(1), 2);
		assert.equal(resolveBayerPatternSize(4), 4);
		assert.equal(resolveBayerPatternSize(7), 8);
	});

	it("preprocesses RGBA data into grayscale with brightness and contrast", () => {
		const processed = preprocessImageData(
			new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]),
			0,
			0,
		);

		assert.deepEqual(
			Array.from(processed),
			[76, 76, 76, 255, 150, 150, 150, 255],
		);
	});

	it("extracts grayscale data and writes dithered pixels back without touching alpha", () => {
		const source = new Uint8ClampedArray([76, 76, 76, 10, 150, 150, 150, 20]);

		assert.deepEqual(Array.from(extractGrayscaleChannel(source)), [76, 150]);
		assert.deepEqual(
			Array.from(
				applyDitheredValuesToImageData(source, new Uint8Array([0, 255]), true),
			),
			[255, 255, 255, 10, 0, 0, 0, 20],
		);
	});

	it("builds a 24-bit BMP buffer with top-down pixel rows and padding", () => {
		const buffer = buildBmpBuffer(
			new Uint8ClampedArray([255, 0, 0, 255]),
			1,
			1,
		);
		const view = new DataView(buffer);
		const bytes = new Uint8Array(buffer);

		assert.equal(view.getUint8(0), 0x42);
		assert.equal(view.getUint8(1), 0x4d);
		assert.equal(view.getUint32(2, true), 58);
		assert.equal(view.getUint32(10, true), 54);
		assert.equal(view.getInt32(18, true), 1);
		assert.equal(view.getInt32(22, true), -1);
		assert.deepEqual(Array.from(bytes.slice(54)), [0, 0, 255, 0]);
	});
});
