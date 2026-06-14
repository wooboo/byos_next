import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("radix-ui", () => ({
	Collapsible: {
		Root: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		CollapsibleTrigger: ({
			children,
			...props
		}: React.ComponentProps<"button">) => (
			<button {...props}>{children}</button>
		),
		CollapsibleContent: ({
			children,
			...props
		}: React.ComponentProps<"div">) => <div {...props}>{children}</div>,
	},
}));

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "./collapsible";

describe("Collapsible", () => {
	it("renders public slots for root, trigger, and content", () => {
		const html = renderToStaticMarkup(
			<Collapsible open>
				<CollapsibleTrigger>Toggle</CollapsibleTrigger>
				<CollapsibleContent>Body</CollapsibleContent>
			</Collapsible>,
		);

		assert.match(html, /data-slot="collapsible"/);
		assert.match(html, /data-slot="collapsible-trigger"/);
		assert.match(html, /data-slot="collapsible-content"/);
		assert.match(html, />Toggle</);
		assert.match(html, />Body</);
	});
});
