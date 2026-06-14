import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("radix-ui", () => ({
	Dialog: {
		Root: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Portal: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Overlay: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Content: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Close: ({
			children,
			asChild,
			...props
		}: React.ComponentProps<"button"> & { asChild?: boolean }) =>
			asChild ? children : <button {...props}>{children}</button>,
		Title: ({ children, ...props }: React.ComponentProps<"h2">) => (
			<h2 {...props}>{children}</h2>
		),
		Description: ({ children, ...props }: React.ComponentProps<"p">) => (
			<p {...props}>{children}</p>
		),
	},
}));

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";

describe("Dialog", () => {
	it("renders public slots and the default close button", () => {
		const html = renderToStaticMarkup(
			<Dialog open>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Title</DialogTitle>
						<DialogDescription>Body</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>,
		);

		assert.match(html, /data-slot="dialog"/);
		assert.match(html, /data-slot="dialog-portal"/);
		assert.match(html, /data-slot="dialog-overlay"/);
		assert.match(html, /data-slot="dialog-content"/);
		assert.match(html, /data-slot="dialog-close"/);
		assert.match(html, /data-slot="dialog-header"/);
		assert.match(html, /data-slot="dialog-title"/);
		assert.match(html, /data-slot="dialog-description"/);
		assert.match(html, /Close/);
	});

	it("supports footer close button and hiding the content close control", () => {
		const html = renderToStaticMarkup(
			<Dialog open>
				<DialogContent showCloseButton={false}>Body</DialogContent>
				<DialogFooter showCloseButton>Actions</DialogFooter>
			</Dialog>,
		);

		assert.doesNotMatch(html, /data-slot="dialog-close"/);
		assert.match(html, /data-slot="dialog-footer"/);
		assert.match(html, />Actions</);
		assert.match(html, />Close</);
	});
});
