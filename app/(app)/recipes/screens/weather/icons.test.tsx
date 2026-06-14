import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import {
	CloudIcon,
	FogIcon,
	humidityIcon,
	pressureIcon,
	RainIcon,
	SnowIcon,
	SunIcon,
	sunriseIcon,
	sunsetIcon,
	ThunderIcon,
	tempDown,
	tempIcon,
	tempUp,
	windIcon,
} from "./icons";

describe("weather icons", () => {
	it("renders main condition icons with the weather aria label", () => {
		const html = renderToStaticMarkup(
			<div>
				<CloudIcon />
				<SunIcon size={96} />
				<ThunderIcon />
				<SnowIcon size={80} />
				<RainIcon />
				<FogIcon size={72} />
			</div>,
		);

		assert.equal((html.match(/aria-label="Weather"/g) ?? []).length, 6);
		assert.match(html, /width="128"/);
		assert.match(html, /width="96"/);
		assert.match(html, /width="80"/);
		assert.match(html, /width="72"/);
	});

	it("renders detail icons with their specific labels and custom sizes", () => {
		const html = renderToStaticMarkup(
			<div>
				{React.createElement(tempUp, { size: 36 })}
				{React.createElement(tempDown)}
				{React.createElement(windIcon, { size: 30 })}
				{React.createElement(tempIcon)}
				{React.createElement(pressureIcon, { size: 32 })}
				{React.createElement(humidityIcon)}
				{React.createElement(sunsetIcon, { size: 28 })}
				{React.createElement(sunriseIcon)}
			</div>,
		);

		assert.match(html, /aria-label="Weather detail"/);
		assert.match(html, /aria-label="Humidity"/);
		assert.match(html, /aria-label="Sunset"/);
		assert.match(html, /aria-label="Sunrise"/);
		assert.match(html, /width="36"/);
		assert.match(html, /width="48"/);
		assert.match(html, /width="32"/);
		assert.match(html, /width="28"/);
	});
});
