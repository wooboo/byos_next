import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import { DeviceFrame } from "./device-frame";

describe("DeviceFrame", () => {
	it("server-renders the default device bezel and screen ratio", () => {
		const html = renderToStaticMarkup(
			<DeviceFrame>
				<div>Screen payload</div>
			</DeviceFrame>,
		);

		assert.match(html, /Screen payload/);
		assert.match(html, /shadow-\[0_20px_40px_-20px_rgba\(0,0,0,0\.45\)\]/);
		assert.match(html, /aspect-ratio:800 \/ 480/);
		assert.match(html, /rounded-\[18px\] p-2/);
	});

	it("uses the requested size, ratio, and flat mode", () => {
		const html = renderToStaticMarkup(
			<DeviceFrame size="sm" screenWidth={320} screenHeight={240} flat>
				<div>Compact screen</div>
			</DeviceFrame>,
		);

		assert.match(html, /Compact screen/);
		assert.match(html, /rounded-lg p-1/);
		assert.match(html, /rounded-\[4px\]/);
		assert.match(html, /aspect-ratio:320 \/ 240/);
		assert.doesNotMatch(
			html,
			/shadow-\[0_20px_40px_-20px_rgba\(0,0,0,0\.45\)\]/,
		);
	});
});
