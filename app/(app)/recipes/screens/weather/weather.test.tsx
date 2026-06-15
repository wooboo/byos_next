import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import Weather from "./weather";

describe("weather screen", () => {
	it("uses a dedicated portrait layout instead of scaling the landscape layout", () => {
		const html = renderToStaticMarkup(
			<Weather
				width={400}
				height={600}
				temperature="12"
				description="Overcast"
				location="Warsaw, Poland"
				highTemp="16"
				lowTemp="12"
			/>,
		);

		assert.match(html, /width:400px/);
		assert.match(html, /height:600px/);
		assert.match(html, /Overcast/);
		assert.doesNotMatch(html, /translate\(/);
	});
});
