import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

const screensState = vi.hoisted(() => ({
	screensResult: [] as Array<{
		id: string;
		name: string;
		recipe_id: string;
		recipe_name: string;
	}>,
}));

vi.mock("@/app/actions/screens", () => ({
	listScreens: vi.fn(async () => screensState.screensResult),
}));

vi.mock("next/image", () => ({
	default: ({ alt, src, width, height }: React.ComponentProps<"img">) => (
		<div
			data-alt={alt}
			data-src={src}
			data-width={width}
			data-height={height}
		/>
	),
}));

vi.mock("@/components/common/page-template", () => ({
	PageTemplate: ({
		title,
		subtitle,
		children,
	}: {
		title: string;
		subtitle: string;
		children: React.ReactNode;
	}) => (
		<div>
			<h1>{title}</h1>
			<p>{subtitle}</p>
			{children}
		</div>
	),
}));

type ScreensPageModule = typeof import("./page.tsx");
let moduleCache: ScreensPageModule | null = null;

async function getPage() {
	if (!moduleCache) {
		moduleCache = await import("./page.tsx");
	}
	return moduleCache.default;
}

describe("Screens page", () => {
	it("renders empty state when no screens exist", async () => {
		screensState.screensResult = [];
		const ScreensPage = await getPage();
		const html = renderToStaticMarkup(await ScreensPage());

		assert.match(html, /No screens yet/);
		assert.match(html, /Screens/);
	});

	it("renders list cards for populated screens", async () => {
		screensState.screensResult = [
			{
				id: "screen-1",
				name: "Kitchen",
				recipe_id: "recipe-1",
				recipe_name: "Weather",
			},
			{
				id: "screen-2",
				name: "Lobby",
				recipe_id: "recipe-2",
				recipe_name: "Calendar",
			},
		];
		const ScreensPage = await getPage();
		const html = renderToStaticMarkup(await ScreensPage());

		assert.match(html, /Kitchen/);
		assert.match(html, /Lobby/);
		assert.match(html, /Recipe: Weather/);
		assert.match(html, /Recipe: Calendar/);
		assert.match(html, /\/screens\/screen-1/);
	});
});
