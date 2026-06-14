import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("cmdk", () => ({
	Command: Object.assign(
		({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		{
			Input: ({ ...props }: React.ComponentProps<"input">) => (
				<input {...props} />
			),
			List: ({ children, ...props }: React.ComponentProps<"div">) => (
				<div {...props}>{children}</div>
			),
			Empty: ({ children, ...props }: React.ComponentProps<"div">) => (
				<div {...props}>{children}</div>
			),
			Group: ({ children, ...props }: React.ComponentProps<"div">) => (
				<div {...props}>{children}</div>
			),
			Separator: ({ ...props }: React.ComponentProps<"hr">) => (
				<hr {...props} />
			),
			Item: ({ children, ...props }: React.ComponentProps<"div">) => (
				<div {...props}>{children}</div>
			),
		},
	),
}));

vi.mock("@/components/ui/dialog", () => ({
	Dialog: ({ children, ...props }: React.ComponentProps<"div">) => (
		<div data-slot="mock-dialog" {...props}>
			{children}
		</div>
	),
	DialogContent: ({
		children,
		showCloseButton,
		...props
	}: React.ComponentProps<"div"> & { showCloseButton?: boolean }) => (
		<div
			data-slot="mock-dialog-content"
			data-show-close-button={showCloseButton}
			{...props}
		>
			{children}
		</div>
	),
	DialogDescription: ({ children, ...props }: React.ComponentProps<"p">) => (
		<p data-slot="mock-dialog-description" {...props}>
			{children}
		</p>
	),
	DialogHeader: ({ children, ...props }: React.ComponentProps<"div">) => (
		<div data-slot="mock-dialog-header" {...props}>
			{children}
		</div>
	),
	DialogTitle: ({ children, ...props }: React.ComponentProps<"h2">) => (
		<h2 data-slot="mock-dialog-title" {...props}>
			{children}
		</h2>
	),
}));

import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "./command";

describe("Command", () => {
	it("renders the command dialog with default metadata and child slots", () => {
		const html = renderToStaticMarkup(
			<CommandDialog open>
				<CommandInput placeholder="Search commands" />
				<CommandList>
					<CommandEmpty>No results</CommandEmpty>
					<CommandGroup heading="Group">
						<CommandItem>Run task</CommandItem>
					</CommandGroup>
					<CommandSeparator />
				</CommandList>
			</CommandDialog>,
		);

		assert.match(html, /data-slot="mock-dialog"/);
		assert.match(html, /Command Palette/);
		assert.match(html, /Search for a command to run/);
		assert.match(html, /data-show-close-button="true"/);
		assert.match(html, /data-slot="command"/);
		assert.match(html, /data-slot="command-input-wrapper"/);
		assert.match(html, /data-slot="command-input"/);
		assert.match(html, /placeholder="Search commands"/);
		assert.match(html, /data-slot="command-list"/);
		assert.match(html, /data-slot="command-empty"/);
		assert.match(html, /data-slot="command-group"/);
		assert.match(html, /data-slot="command-item"/);
		assert.match(html, /data-slot="command-separator"/);
	});

	it("renders the base command root directly", () => {
		const html = renderToStaticMarkup(<Command className="palette" />);

		assert.match(html, /data-slot="command"/);
		assert.match(html, /class="[^"]*palette/);
	});
});
