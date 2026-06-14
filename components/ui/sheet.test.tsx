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
		Close: ({ children, ...props }: React.ComponentProps<"button">) => (
			<button {...props}>{children}</button>
		),
		Title: ({ children, ...props }: React.ComponentProps<"h2">) => (
			<h2 {...props}>{children}</h2>
		),
		Description: ({ children, ...props }: React.ComponentProps<"p">) => (
			<p {...props}>{children}</p>
		),
	},
}));

import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "./sheet";

describe("Sheet", () => {
	it("renders the default right-side sheet with a close button", () => {
		const html = renderToStaticMarkup(
			<Sheet>
				<SheetContent>
					<SheetHeader>
						<SheetTitle>Panel</SheetTitle>
						<SheetDescription>Details</SheetDescription>
					</SheetHeader>
				</SheetContent>
			</Sheet>,
		);

		assert.match(html, /data-slot="sheet"/);
		assert.match(html, /data-slot="sheet-portal"/);
		assert.match(html, /data-slot="sheet-overlay"/);
		assert.match(html, /data-slot="sheet-content"/);
		assert.match(html, /border-l/);
		assert.match(html, /Close/);
		assert.match(html, /data-slot="sheet-header"/);
		assert.match(html, /data-slot="sheet-title"/);
		assert.match(html, /data-slot="sheet-description"/);
	});

	it("supports alternate sides and hiding the close button", () => {
		const leftHtml = renderToStaticMarkup(
			<Sheet>
				<SheetContent side="left" showCloseButton={false}>
					Left
				</SheetContent>
			</Sheet>,
		);
		const topHtml = renderToStaticMarkup(
			<Sheet>
				<SheetContent side="top">Top</SheetContent>
			</Sheet>,
		);
		const bottomHtml = renderToStaticMarkup(
			<Sheet>
				<SheetContent side="bottom">Bottom</SheetContent>
			</Sheet>,
		);

		assert.doesNotMatch(leftHtml, /Close/);
		assert.match(leftHtml, /border-r/);
		assert.match(topHtml, /border-b/);
		assert.match(bottomHtml, /border-t/);
	});
});
