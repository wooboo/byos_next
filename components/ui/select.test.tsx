import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("radix-ui", () => ({
	Select: {
		Root: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Value: ({ children, ...props }: React.ComponentProps<"span">) => (
			<span {...props}>{children}</span>
		),
		Trigger: ({ children, ...props }: React.ComponentProps<"button">) => (
			<button {...props}>{children}</button>
		),
		Icon: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
		Portal: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
		Content: ({
			children,
			position,
			align,
			...props
		}: React.ComponentProps<"div"> & {
			position?: string;
			align?: string;
		}) => (
			<div data-position={position} data-align={align} {...props}>
				{children}
			</div>
		),
		Viewport: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Item: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		ItemIndicator: ({ children }: { children?: React.ReactNode }) => (
			<>{children}</>
		),
		ItemText: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
		ScrollUpButton: ({
			children,
			...props
		}: React.ComponentProps<"button">) => (
			<button {...props}>{children}</button>
		),
		ScrollDownButton: ({
			children,
			...props
		}: React.ComponentProps<"button">) => (
			<button {...props}>{children}</button>
		),
	},
}));

import {
	Select,
	SelectContent,
	SelectItem,
	SelectScrollDownButton,
	SelectScrollUpButton,
	SelectTrigger,
	SelectValue,
} from "./select";

describe("Select", () => {
	it("renders trigger, value, content, item, and scroll controls", () => {
		const html = renderToStaticMarkup(
			<Select>
				<SelectTrigger className="trigger">
					<SelectValue>Alpha</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="alpha">Alpha</SelectItem>
				</SelectContent>
			</Select>,
		);

		assert.match(html, /data-slot="select"/);
		assert.match(html, /data-slot="select-trigger"/);
		assert.match(html, /data-size="default"/);
		assert.match(html, /data-slot="select-value"/);
		assert.match(html, /data-slot="select-content"/);
		assert.match(html, /data-position="item-aligned"/);
		assert.match(html, /data-align="center"/);
		assert.match(html, /data-slot="select-scroll-up-button"/);
		assert.match(html, /data-slot="select-scroll-down-button"/);
		assert.match(html, /data-slot="select-item"/);
		assert.match(html, /data-slot="select-item-indicator"/);
		assert.match(html, /class="[^"]*trigger/);
	});

	it("supports small triggers and popper positioning", () => {
		const triggerHtml = renderToStaticMarkup(
			<SelectTrigger size="sm">
				<SelectValue>Beta</SelectValue>
			</SelectTrigger>,
		);
		const contentHtml = renderToStaticMarkup(
			<SelectContent position="popper" align="start">
				Body
			</SelectContent>,
		);
		const upHtml = renderToStaticMarkup(
			<SelectScrollUpButton className="up" />,
		);
		const downHtml = renderToStaticMarkup(
			<SelectScrollDownButton className="down" />,
		);

		assert.match(triggerHtml, /data-size="sm"/);
		assert.match(contentHtml, /data-position="popper"/);
		assert.match(contentHtml, /data-align="start"/);
		assert.match(upHtml, /class="[^"]*up/);
		assert.match(downHtml, /class="[^"]*down/);
	});
});
