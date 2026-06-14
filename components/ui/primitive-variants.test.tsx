import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("radix-ui", () => ({
	Progress: {
		Root: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Indicator: (props: React.ComponentProps<"div">) => <div {...props} />,
	},
	Slider: {
		Root: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Track: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Range: (props: React.ComponentProps<"div">) => <div {...props} />,
		Thumb: (props: React.ComponentProps<"button">) => (
			<button type="button" {...props} />
		),
	},
	Tabs: {
		Root: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		List: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Trigger: ({ children, ...props }: React.ComponentProps<"button">) => (
			<button type="button" {...props}>
				{children}
			</button>
		),
		Content: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
	},
	ToggleGroup: {
		Root: ({ children, ...props }: React.ComponentProps<"div">) => (
			<div {...props}>{children}</div>
		),
		Item: ({ children, ...props }: React.ComponentProps<"button">) => (
			<button type="button" {...props}>
				{children}
			</button>
		),
	},
	Slot: {
		Root: ({ children, ...props }: React.ComponentProps<"span">) => (
			<span data-slot-root="true" {...props}>
				{children}
			</span>
		),
	},
}));

import { Badge } from "./badge";
import { Progress } from "./progress";
import { Slider } from "./slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

describe("primitive UI variants", () => {
	it("renders progress with explicit and fallback values", () => {
		const explicit = renderToStaticMarkup(<Progress value={35} />);
		const fallback = renderToStaticMarkup(<Progress />);

		assert.match(explicit, /data-slot="progress"/);
		assert.match(explicit, /translateX\(-65%\)/);
		assert.match(fallback, /translateX\(-100%\)/);
	});

	it("renders slider thumbs from value, defaultValue, and min-max fallback", () => {
		const valueHtml = renderToStaticMarkup(<Slider value={[20]} />);
		const defaultHtml = renderToStaticMarkup(
			<Slider defaultValue={[10, 90]} />,
		);
		const fallbackHtml = renderToStaticMarkup(<Slider min={5} max={15} />);

		assert.equal(valueHtml.match(/data-slot="slider-thumb"/g)?.length, 1);
		assert.equal(defaultHtml.match(/data-slot="slider-thumb"/g)?.length, 2);
		assert.equal(fallbackHtml.match(/data-slot="slider-thumb"/g)?.length, 2);
		assert.match(fallbackHtml, /min="5"/);
		assert.match(fallbackHtml, /max="15"/);
	});

	it("renders tabs with orientation and list variants", () => {
		const html = renderToStaticMarkup(
			<Tabs orientation="vertical" className="tabs-shell">
				<TabsList variant="line" className="tabs-list">
					<TabsTrigger value="one">One</TabsTrigger>
				</TabsList>
				<TabsContent value="one">Panel</TabsContent>
			</Tabs>,
		);

		assert.match(html, /data-slot="tabs"/);
		assert.match(html, /data-orientation="vertical"/);
		assert.match(html, /data-variant="line"/);
		assert.match(html, /tabs-shell/);
		assert.match(html, /tabs-list/);
		assert.match(html, />One</);
		assert.match(html, />Panel</);
	});

	it("passes toggle group context into items and allows item overrides", () => {
		const grouped = renderToStaticMarkup(
			<ToggleGroup type="single" variant="outline" size="sm" spacing={2}>
				<ToggleGroupItem value="left">Left</ToggleGroupItem>
			</ToggleGroup>,
		);
		const standalone = renderToStaticMarkup(
			<ToggleGroupItem value="right" variant="default" size="lg">
				Right
			</ToggleGroupItem>,
		);

		assert.match(grouped, /data-slot="toggle-group"/);
		assert.match(grouped, /data-spacing="2"/);
		assert.match(grouped, /data-variant="outline"/);
		assert.match(grouped, /data-size="sm"/);
		assert.match(standalone, /data-variant="default"/);
		assert.match(standalone, /data-size="default"/);
	});

	it("renders badge variants and the slot-backed asChild path", () => {
		const html = renderToStaticMarkup(
			<>
				<Badge variant="destructive">Danger</Badge>
				<Badge asChild variant="link">
					<a href="/docs">Docs</a>
				</Badge>
			</>,
		);

		assert.match(html, /data-slot="badge"/);
		assert.match(html, /data-variant="destructive"/);
		assert.match(html, />Danger</);
		assert.match(html, /data-slot-root="true"/);
		assert.match(html, /data-variant="link"/);
		assert.match(html, />Docs</);
	});
});
