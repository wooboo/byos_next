import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("radix-ui", () => ({
	Label: {
		Root: ({
			children,
			htmlFor,
			...props
		}: React.ComponentProps<"div"> & { htmlFor?: string }) => (
			<div data-html-for={htmlFor} {...props}>
				{children}
			</div>
		),
	},
}));

import { Label } from "./label";

describe("Label", () => {
	it("renders the public slot and forwards htmlFor", () => {
		const html = renderToStaticMarkup(
			<Label htmlFor="email" className="field-label">
				Email
			</Label>,
		);

		assert.match(html, /data-slot="label"/);
		assert.match(html, /data-html-for="email"/);
		assert.match(html, /field-label/);
		assert.match(html, />Email</);
	});
});
