import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("radix-ui", () => ({
	Popover: {
		Root: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Trigger: ({ children, ...props }: React.ComponentProps<"button">) => (
			<button {...props}>{children}</button>
		),
		Portal: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
		Content: ({
			children,
			align,
			sideOffset,
			...props
		}: React.ComponentProps<"div"> & {
			align?: string;
			sideOffset?: number;
		}) => (
			<div data-align={align} data-side-offset={sideOffset} {...props}>
				{children}
			</div>
		),
	},
}));

import { Popover, PopoverContent, PopoverTrigger } from "./popover";

describe("Popover", () => {
	it("renders trigger and content with default placement props", () => {
		const html = renderToStaticMarkup(
			<Popover>
				<PopoverTrigger>Open</PopoverTrigger>
				<PopoverContent className="panel">Body</PopoverContent>
			</Popover>,
		);

		assert.match(html, /data-slot="popover"/);
		assert.match(html, /data-slot="popover-trigger"/);
		assert.match(html, /data-slot="popover-content"/);
		assert.match(html, /data-align="center"/);
		assert.match(html, /data-side-offset="4"/);
		assert.match(html, /class="[^"]*panel/);
	});
});
