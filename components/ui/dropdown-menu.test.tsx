import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("radix-ui", () => ({
	DropdownMenu: {
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
		Group: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Item: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Label: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Separator: (props: React.ComponentProps<"hr">) => <hr {...props} />,
	},
}));

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./dropdown-menu";

describe("DropdownMenu", () => {
	it("renders trigger, content, items, labels, and separators", () => {
		const html = renderToStaticMarkup(
			<DropdownMenu>
				<DropdownMenuTrigger>Open</DropdownMenuTrigger>
				<DropdownMenuContent className="menu">
					<DropdownMenuGroup>
						<DropdownMenuLabel inset>Options</DropdownMenuLabel>
						<DropdownMenuItem inset variant="destructive">
							Delete
						</DropdownMenuItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
				</DropdownMenuContent>
			</DropdownMenu>,
		);

		assert.match(html, /data-slot="dropdown-menu"/);
		assert.match(html, /data-slot="dropdown-menu-trigger"/);
		assert.match(html, /data-slot="dropdown-menu-content"/);
		assert.match(html, /data-side-offset="4"/);
		assert.match(html, /data-slot="dropdown-menu-group"/);
		assert.match(html, /data-slot="dropdown-menu-label"/);
		assert.match(html, /data-inset="true"/);
		assert.match(html, /data-slot="dropdown-menu-item"/);
		assert.match(html, /data-variant="destructive"/);
		assert.match(html, /data-slot="dropdown-menu-separator"/);
		assert.match(html, /class="[^"]*menu/);
	});
});
