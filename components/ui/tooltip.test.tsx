import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("radix-ui", () => ({
	Tooltip: {
		Provider: ({
			children,
			delayDuration,
			...props
		}: React.ComponentProps<"div"> & { delayDuration?: number }) => (
			<div data-delay-duration={delayDuration} {...props}>
				{children}
			</div>
		),
		Root: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Trigger: ({ children, ...props }: React.ComponentProps<"button">) => (
			<button {...props}>{children}</button>
		),
		Portal: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
		Content: ({
			children,
			sideOffset,
			...props
		}: React.ComponentProps<"div"> & { sideOffset?: number }) => (
			<div data-side-offset={sideOffset} {...props}>
				{children}
			</div>
		),
		Arrow: (props: React.ComponentProps<"span">) => (
			<span data-slot="tooltip-arrow" {...props} />
		),
	},
}));

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./tooltip";

describe("Tooltip", () => {
	it("renders provider, trigger, content, and arrow with defaults", () => {
		const html = renderToStaticMarkup(
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger>Open</TooltipTrigger>
					<TooltipContent className="bubble">Details</TooltipContent>
				</Tooltip>
			</TooltipProvider>,
		);

		assert.match(html, /data-slot="tooltip-provider"/);
		assert.match(html, /data-delay-duration="0"/);
		assert.match(html, /data-slot="tooltip"/);
		assert.match(html, /data-slot="tooltip-trigger"/);
		assert.match(html, /data-slot="tooltip-content"/);
		assert.match(html, /data-side-offset="0"/);
		assert.match(html, /data-slot="tooltip-arrow"/);
		assert.match(html, /class="[^"]*bubble/);
	});
});
