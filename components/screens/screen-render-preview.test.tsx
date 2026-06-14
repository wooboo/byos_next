import assert from "node:assert/strict";
import * as React from "react";
import { renderToReadableStream } from "react-dom/server";
import { beforeEach, describe, it, vi } from "vitest";

type CapturedRenderArgs = {
	slug: string;
	imageWidth: number;
	imageHeight: number;
	formats: string[];
	props: Record<string, unknown>;
	config: Record<string, unknown>;
};

const state = vi.hoisted(() => ({
	config: { refresh: 30 } as Record<string, unknown> | null,
	component: ((props: Record<string, unknown>) => (
		<div>recipe-component:{JSON.stringify(props)}</div>
	)) as React.ComponentType<Record<string, unknown>> | null,
	props: { city: "Warsaw" } as Record<string, unknown>,
	renders: {
		bitmap: { toString: () => "bitmap-data" },
		png: { toString: () => "png-data" },
	} as {
		bitmap?: { toString: (encoding: "base64") => string } | null;
		png?: { toString: (encoding: "base64") => string } | null;
	},
	renderCalls: [] as CapturedRenderArgs[],
}));

vi.mock("@/components/preview/render-output-preview", () => ({
	EmptyRenderState: ({ children }: { children: React.ReactNode }) => (
		<div>empty:{children}</div>
	),
	RenderLoadingState: ({ label }: { label: string }) => (
		<div>loading:{label}</div>
	),
	RenderOutputImage: ({
		format,
		image,
		title,
		imageWidth,
		imageHeight,
	}: {
		format: string;
		image?: { toString: (encoding: "base64") => string } | null;
		title: string;
		imageWidth: number;
		imageHeight: number;
	}) =>
		image ? (
			<div
				data-format={format}
				data-title={title}
				data-width={String(imageWidth)}
				data-height={String(imageHeight)}
				data-image={image.toString("base64")}
			>
				render-output
			</div>
		) : (
			<div>
				empty:Failed to generate {format === "bitmap" ? "bitmap" : "PNG"}
			</div>
		),
	ScaledRenderPreview: ({
		imageWidth,
		imageHeight,
		children,
	}: {
		imageWidth: number;
		imageHeight: number;
		children: React.ReactNode;
	}) => (
		<div data-width={String(imageWidth)} data-height={String(imageHeight)}>
			{children}
		</div>
	),
}));

vi.mock("@/components/recipes/recipe-preview-stage", () => ({
	RecipePreviewStage: ({
		slug,
		basePath,
		bitmapUrl,
		isPortrait,
		bmpNode,
		pngNode,
		reactPreviewSrc,
		bmpPipeline,
		pngPipeline,
		reactPipeline,
	}: {
		slug: string;
		basePath: string;
		bitmapUrl: string;
		isPortrait: boolean;
		bmpNode: React.ReactNode;
		pngNode: React.ReactNode;
		reactPreviewSrc: string;
		bmpPipeline: React.ReactNode;
		pngPipeline: React.ReactNode;
		reactPipeline: React.ReactNode;
	}) => (
		<div
			data-slug={slug}
			data-base-path={basePath}
			data-bitmap-url={bitmapUrl}
			data-is-portrait={String(isPortrait)}
			data-react-preview-src={reactPreviewSrc}
		>
			<div>{bmpNode}</div>
			<div>{pngNode}</div>
			<div>{bmpPipeline}</div>
			<div>{pngPipeline}</div>
			<div>{reactPipeline}</div>
		</div>
	),
}));

vi.mock("@/lib/recipes/recipe-renderer", () => ({
	addDimensionsToProps: vi.fn(
		(props: Record<string, unknown>, width: number, height: number) => ({
			...props,
			width,
			height,
		}),
	),
	fetchRecipeComponent: vi.fn(
		() =>
			state.component as React.ComponentType<Record<string, unknown>> | null,
	),
	fetchRecipeConfig: vi.fn(async () => state.config),
	fetchRecipeProps: vi.fn(async () => state.props),
	renderRecipeOutputs: vi.fn(async (args: CapturedRenderArgs) => {
		state.renderCalls.push(args);
		return state.renders;
	}),
}));

type ScreenRenderPreviewModule = typeof import("./screen-render-preview");
let moduleCache: ScreenRenderPreviewModule | null = null;

async function getModule() {
	if (!moduleCache) {
		moduleCache = await import("./screen-render-preview");
	}
	return moduleCache;
}

async function renderAsync(element: React.ReactElement) {
	const stream = await renderToReadableStream(element);
	await stream.allReady;
	return (await new Response(stream).text()).replaceAll("<!-- -->", "");
}

describe("ScreenRenderPreview", () => {
	beforeEach(() => {
		state.config = { refresh: 30 };
		state.component = (props: Record<string, unknown>) => (
			<div>recipe-component:{JSON.stringify(props)}</div>
		);
		state.props = { city: "Warsaw" };
		state.renders = {
			bitmap: { toString: () => "bitmap-data" },
			png: { toString: () => "png-data" },
		};
		state.renderCalls = [];
		moduleCache = null;
	});

	it("wires screen-specific stage props and bitmap/png render outputs", async () => {
		const { ScreenRenderPreview } = await getModule();
		const html = await renderAsync(
			<ScreenRenderPreview
				screenId="screen-1"
				recipeSlug="weather"
				title="Lobby weather"
				isPortrait
				imageWidth={480}
				imageHeight={800}
				paramsOverride={{ city: "Warsaw" }}
				userId="user-1"
			/>,
		);

		const uniqueCalls = Array.from(
			new Map(
				state.renderCalls.map((call) => [call.formats[0], call]),
			).values(),
		);

		assert.deepEqual(uniqueCalls.map((call) => call.formats[0]).sort(), [
			"bitmap",
			"png",
		]);
		const bitmapCall = uniqueCalls.find((call) => call.formats[0] === "bitmap");
		assert.deepEqual(bitmapCall?.props, {
			city: "Warsaw",
			width: 480,
			height: 800,
		});
		assert.match(html, /data-slug="screen-1"/);
		assert.match(html, /data-base-path="\/screens\/screen-1"/);
		assert.match(
			html,
			/data-bitmap-url="\/api\/bitmap\/screen\/screen-1\.bmp"/,
		);
		assert.match(html, /data-react-preview-src="\/preview\/screen\/screen-1"/);
		assert.match(html, /render-output/);
		assert.match(html, /data-format="bitmap"/);
		assert.match(html, /data-image="bitmap-data"/);
		assert.match(html, /data-format="png"/);
		assert.match(html, /data-image="png-data"/);
		assert.match(html, /Screen params/);
		assert.match(html, /\/api\/bitmap\/screen\/screen-1/);
	});

	it("renders empty states when the recipe configuration is missing", async () => {
		state.config = null;
		const { ScreenRenderPreview } = await getModule();
		const html = await renderAsync(
			<ScreenRenderPreview
				screenId="screen-2"
				recipeSlug="weather"
				title="Broken config"
				isPortrait={false}
				imageWidth={800}
				imageHeight={480}
				paramsOverride={{}}
			/>,
		);

		assert.equal(state.renderCalls.length, 0);
		assert.equal(
			(html.match(/empty:Configuration not found/g) ?? []).length,
			2,
		);
	});

	it("renders failed output fallbacks when bitmap and png generation return null", async () => {
		state.renders = { bitmap: null, png: null };
		const { ScreenRenderPreview } = await getModule();
		const html = await renderAsync(
			<ScreenRenderPreview
				screenId="screen-3"
				recipeSlug="weather"
				title="Empty output"
				isPortrait={false}
				imageWidth={800}
				imageHeight={480}
				paramsOverride={{ city: "Berlin" }}
			/>,
		);

		const uniqueCalls = Array.from(
			new Map(
				state.renderCalls.map((call) => [call.formats[0], call]),
			).values(),
		);

		assert.deepEqual(uniqueCalls.map((call) => call.formats[0]).sort(), [
			"bitmap",
			"png",
		]);
		assert.match(html, /empty:Failed to generate bitmap/);
		assert.match(html, /empty:Failed to generate PNG/);
	});
});
