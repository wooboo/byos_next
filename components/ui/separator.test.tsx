import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("radix-ui", () => ({
	Separator: {
		Root: ({
			children,
			orientation,
			decorative,
			...props
		}: React.ComponentProps<"div"> & {
			orientation?: "horizontal" | "vertical";
			decorative?: boolean;
		}) => (
			<div
				data-orientation={orientation}
				data-decorative={decorative}
				{...props}
			>
				{children}
			</div>
		),
	},
}));

import { Separator } from "./separator";

describe("Separator", () => {
	it("renders default and explicit orientation props", () => {
		const verticalHtml = renderToStaticMarkup(
			<Separator orientation="vertical" decorative={false} className="rule" />,
		);
		const defaultHtml = renderToStaticMarkup(<Separator />);

		assert.match(verticalHtml, /data-slot="separator"/);
		assert.match(verticalHtml, /data-orientation="vertical"/);
		assert.match(verticalHtml, /data-decorative="false"/);
		assert.match(verticalHtml, /class="[^"]*rule/);
		assert.match(defaultHtml, /data-orientation="horizontal"/);
		assert.match(defaultHtml, /data-decorative="true"/);
	});
});
