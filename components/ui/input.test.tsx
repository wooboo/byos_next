import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import { Input } from "./input";

describe("Input", () => {
	it("renders input props and data slot", () => {
		const html = renderToStaticMarkup(
			<Input
				type="email"
				placeholder="Email"
				aria-invalid
				className="field"
				defaultValue="user@example.com"
			/>,
		);

		assert.match(html, /data-slot="input"/);
		assert.match(html, /type="email"/);
		assert.match(html, /placeholder="Email"/);
		assert.match(html, /aria-invalid="true"/);
		assert.match(html, /value="user@example.com"/);
		assert.match(html, /class="[^"]*field/);
	});
});
