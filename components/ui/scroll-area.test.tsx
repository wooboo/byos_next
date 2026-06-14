import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("radix-ui", () => ({
	ScrollArea: {
		Root: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Viewport: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		ScrollAreaScrollbar: ({
			children,
			orientation,
			...props
		}: React.ComponentProps<"div"> & {
			orientation?: "horizontal" | "vertical";
		}) => (
			<div data-orientation={orientation} {...props}>
				{children}
			</div>
		),
		ScrollAreaThumb: (props: React.ComponentProps<"div">) => <div {...props} />,
		Corner: (props: React.ComponentProps<"div">) => (
			<div data-slot="corner" {...props} />
		),
	},
}));

import { ScrollArea, ScrollBar } from "./scroll-area";

describe("ScrollArea", () => {
	it("renders viewport, scrollbar, thumb, and corner slots", () => {
		const html = renderToStaticMarkup(
			<ScrollArea className="shell">
				<div>Content</div>
			</ScrollArea>,
		);

		assert.match(html, /data-slot="scroll-area"/);
		assert.match(html, /data-slot="scroll-area-viewport"/);
		assert.match(html, /data-slot="scroll-area-scrollbar"/);
		assert.match(html, /data-slot="scroll-area-thumb"/);
		assert.match(html, /data-slot="corner"/);
		assert.match(html, /class="[^"]*shell/);
	});

	it("supports horizontal scrollbars", () => {
		const html = renderToStaticMarkup(<ScrollBar orientation="horizontal" />);

		assert.match(html, /data-orientation="horizontal"/);
		assert.match(html, /data-slot="scroll-area-scrollbar"/);
	});
});
