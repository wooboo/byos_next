import assert from "node:assert/strict";
import * as React from "react";
import { renderToReadableStream, renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RecipeConfig } from "@/lib/recipes/recipe-renderer";

type CapturedPageTemplateProps = {
	title: React.ReactNode;
	subtitle: React.ReactNode;
	left?: React.ReactNode;
};

type CapturedScreenParamsFormProps = {
	slug: string;
	paramsSchema: Record<string, unknown>;
	initialValues: Record<string, unknown>;
	updateAction: (...args: unknown[]) => unknown;
};

const recipePageState = vi.hoisted(() => ({
	config: null as RecipeConfig | null,
	liquidMeta: null as null | {
		name: string;
		description: string | null;
		category: string | null;
		version: string | null;
		updated_at: string | null;
	},
	liquidSettings: { custom_fields: [] as unknown[] },
	screenParams: {} as Record<string, unknown>,
	notFoundCalls: 0,
	pageTemplateProps: null as CapturedPageTemplateProps | null,
	screenParamsFormProps: null as CapturedScreenParamsFormProps | null,
	recipePropsSlug: null as string | null,
	previewStageSlug: null as string | null,
	reactPreviewSrc: null as string | null,
}));

vi.mock("next/cache", () => ({
	cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
	revalidateTag: vi.fn(),
}));

vi.mock("next/headers", () => ({
	headers: vi.fn(),
}));

vi.mock("next/link", () => ({
	default: ({
		href,
		children,
	}: {
		href: string;
		children: React.ReactNode;
	}) => <a href={href}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
	notFound: () => {
		recipePageState.notFoundCalls += 1;
		throw new Error("NOT_FOUND");
	},
}));

vi.mock("@/app/actions/mixup", () => ({
	fetchRecipes: vi.fn(async () => []),
}));

vi.mock("@/app/actions/screens-params", () => ({
	getScreenParams: vi.fn(async () => recipePageState.screenParams),
	updateScreenParams: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/components/common/page-template", () => ({
	PageTemplate: (
		props: CapturedPageTemplateProps & { children: React.ReactNode },
	) => {
		recipePageState.pageTemplateProps = props;
		return <div>{props.children}</div>;
	},
}));

vi.mock("@/components/preview/render-output-preview", () => ({
	EmptyRenderState: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	RenderLoadingState: ({ label }: { label: string }) => <div>{label}</div>,
	RenderOutputForFormat: ({ format }: { format: string }) => (
		<div>render:{format}</div>
	),
	ScaledRenderPreview: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/recipes/delete-recipe-button", () => ({
	DeleteRecipeButton: ({ slug }: { slug: string }) => <div>delete:{slug}</div>,
}));

vi.mock("@/components/recipes/recipe-preview-stage", () => ({
	RecipePreviewStage: ({
		slug,
		bmpNode,
		pngNode,
		reactNode,
		reactPreviewSrc,
		bmpPipeline,
		pngPipeline,
		reactPipeline,
	}: {
		slug: string;
		bmpNode?: React.ReactNode;
		pngNode?: React.ReactNode;
		reactNode?: React.ReactNode;
		reactPreviewSrc?: string;
		bmpPipeline: React.ReactNode;
		pngPipeline: React.ReactNode;
		reactPipeline?: React.ReactNode;
	}) => {
		recipePageState.previewStageSlug = slug;
		recipePageState.reactPreviewSrc = reactPreviewSrc ?? null;
		return (
			<div>
				preview-stage:{slug}
				<div>{bmpNode}</div>
				<div>{pngNode}</div>
				<div>{reactNode}</div>
				{reactPreviewSrc ? <div>react-preview:{reactPreviewSrc}</div> : null}
				<div>{bmpPipeline}</div>
				<div>{pngPipeline}</div>
				<div>{reactPipeline}</div>
			</div>
		);
	},
}));

vi.mock("@/components/recipes/recipe-props", () => ({
	default: ({ slug }: { slug: string }) => {
		recipePageState.recipePropsSlug = slug;
		return <div>recipe-props:{slug}</div>;
	},
}));

vi.mock("@/components/recipes/screen-params-form", () => ({
	ScreenParamsForm: (props: {
		slug: string;
		paramsSchema: Record<string, unknown>;
		initialValues: Record<string, unknown>;
		updateAction: (...args: unknown[]) => unknown;
	}) => {
		recipePageState.screenParamsFormProps = props;
		return <div>screen-params-form:{props.slug}</div>;
	},
}));

vi.mock("@/components/ui/badge", () => ({
	Badge: ({ children }: { children: React.ReactNode }) => (
		<span>{children}</span>
	),
}));

vi.mock("@/lib/database/scoped-db", () => ({
	withUserScope: vi.fn(async () => recipePageState.liquidMeta),
}));

vi.mock("@/lib/database/utils", () => ({
	checkDbConnection: vi.fn(async () => ({ ready: true })),
}));

vi.mock("@/lib/recipes/liquid-preview", () => ({
	default: ({ html }: { html: string }) => <div>{html}</div>,
}));

vi.mock("@/lib/recipes/liquid-renderer", () => ({
	customFieldsToParamDefinitions: vi.fn((fields: Array<{ name: string }>) =>
		Object.fromEntries(fields.map((field) => [field.name, { type: "string" }])),
	),
	fetchLiquidRecipeSettings: vi.fn(async () => recipePageState.liquidSettings),
	renderLiquidRecipe: vi.fn(async () => ({ html: "<div>liquid html</div>" })),
}));

vi.mock("@/lib/recipes/recipe-renderer", () => ({
	addDimensionsToProps: vi.fn((props: Record<string, unknown>) => props),
	DEFAULT_IMAGE_HEIGHT: 480,
	DEFAULT_IMAGE_WIDTH: 800,
	fetchRecipeComponent: vi.fn(() => () => <div>react-recipe-component</div>),
	fetchRecipeConfig: vi.fn(async () => recipePageState.config),
	fetchRecipeProps: vi.fn(async () => ({ city: "Warsaw" })),
	getRendererType: vi.fn(() => "browser"),
	isBuildPhase: vi.fn(() => false),
	logger: { info: vi.fn(), error: vi.fn() },
	renderRecipeOutputs: vi.fn(async () => ({
		bitmap: Buffer.from("bmp"),
		png: Buffer.from("png"),
		svg: "<svg />",
	})),
}));

type RecipePageModule = typeof import("./page.tsx");
let moduleCache: RecipePageModule | null = null;

async function getModule() {
	if (!moduleCache) {
		moduleCache = await import("./page.tsx");
	}
	return moduleCache;
}

async function renderAsync(element: React.ReactElement) {
	const stream = await renderToReadableStream(element);
	await stream.allReady;
	return (await new Response(stream).text()).replaceAll("<!-- -->", "");
}

afterEach(() => {
	vi.clearAllMocks();
	recipePageState.config = null;
	recipePageState.liquidMeta = null;
	recipePageState.liquidSettings = { custom_fields: [] as unknown[] };
	recipePageState.screenParams = {};
	recipePageState.notFoundCalls = 0;
	recipePageState.pageTemplateProps = null;
	recipePageState.screenParamsFormProps = null;
	recipePageState.recipePropsSlug = null;
	recipePageState.previewStageSlug = null;
	recipePageState.reactPreviewSrc = null;
});

describe("Recipe detail page", () => {
	it("returns metadata and both static-params branches", async () => {
		const { fetchRecipes } = await import("@/app/actions/mixup");
		vi.mocked(fetchRecipes).mockResolvedValueOnce([
			{ slug: "weather" },
		] as never);

		const module = await getModule();
		assert.deepEqual(await module.generateMetadata(), {});
		assert.deepEqual(await module.generateStaticParams(), [
			{ slug: "weather" },
		]);

		vi.mocked(fetchRecipes).mockRejectedValueOnce(new Error("offline"));
		assert.deepEqual(await module.generateStaticParams(), [{ slug: "_" }]);
	});

	it("renders the react recipe branch, preview pipelines, and data props", async () => {
		recipePageState.config = {
			title: "Weather",
			description: "Forecast",
			version: "3",
			category: "daily-info",
			params: { city: { type: "string", label: "City" } },
			hasDataFetch: true,
			renderSettings: { doubleSizeForSharperText: true },
		};
		recipePageState.screenParams = { city: "Warsaw" };

		const module = await getModule();
		const html = await renderAsync(
			await module.default({
				params: Promise.resolve({ slug: "weather" }),
				searchParams: Promise.resolve({}),
			}),
		);

		assert.ok(recipePageState.pageTemplateProps);
		assert.equal(recipePageState.previewStageSlug, "weather");
		const subtitleHtml = renderToStaticMarkup(
			recipePageState.pageTemplateProps?.subtitle,
		);
		const reactParamsFormProps =
			recipePageState.screenParamsFormProps as unknown as CapturedScreenParamsFormProps;
		assert.ok(reactParamsFormProps);
		expect(reactParamsFormProps).toMatchObject({
			slug: "weather",
			paramsSchema: { city: { type: "string", label: "City" } },
			initialValues: { city: "Warsaw" },
		});
		assert.equal(typeof reactParamsFormProps.updateAction, "function");
		assert.match(html, /preview-stage:weather/);
		assert.doesNotMatch(html, /render:bitmap/);
		assert.doesNotMatch(html, /render:png/);
		assert.match(html, /react-preview:\/preview\/recipe\/weather/);
		assert.match(html, /JSX → browser PNG → render-bmp/);
		assert.match(html, /JSX → browser PNG →/);
		assert.doesNotMatch(html, /pre-satori/);
		assert.match(html, /screen-params-form:weather/);
		assert.match(html, /recipe-props:weather/);
		assert.match(subtitleHtml, /Rendering at double size for sharper text/);
	});

	it("renders the liquid recipe branch and uses custom field params", async () => {
		recipePageState.config = null;
		recipePageState.liquidMeta = {
			name: "Liquid Weather",
			description: "Liquid forecast",
			category: "daily-info",
			version: "5",
			updated_at: "2026-06-13T00:00:00.000Z",
		};
		recipePageState.liquidSettings = {
			custom_fields: [{ name: "city" }],
		};
		recipePageState.screenParams = { city: "Berlin" };
		recipePageState.screenParamsFormProps = null;
		recipePageState.previewStageSlug = null;

		const module = await getModule();
		const html = await renderAsync(
			await module.default({
				params: Promise.resolve({ slug: "liquid-weather" }),
				searchParams: Promise.resolve({ format: "portrait" }),
			}),
		);

		assert.equal(recipePageState.previewStageSlug, "liquid-weather");
		const liquidParamsFormProps =
			recipePageState.screenParamsFormProps as unknown as CapturedScreenParamsFormProps;
		assert.ok(liquidParamsFormProps);
		expect(liquidParamsFormProps).toMatchObject({
			slug: "liquid-weather",
			paramsSchema: { city: { type: "string" } },
			initialValues: { city: "Berlin" },
		});
		assert.equal(typeof liquidParamsFormProps.updateAction, "function");
		assert.match(html, /preview-stage:liquid-weather/);
		assert.doesNotMatch(html, /render:bitmap/);
		assert.doesNotMatch(html, /render:png/);
		assert.match(html, /liquid html/);
		assert.match(html, /\/api\/bitmap\/liquid-weather\/default\.bmp/);
		assert.match(html, /\/api\/png\/liquid-weather\/default\.png/);
	});

	it("renders the react recipe branch without params or data sections", async () => {
		recipePageState.config = {
			title: "Minimal Recipe",
		};

		const module = await getModule();
		const html = await renderAsync(
			await module.default({
				params: Promise.resolve({ slug: "minimal" }),
				searchParams: Promise.resolve({}),
			}),
		);

		assert.match(html, /preview-stage:minimal/);
		assert.doesNotMatch(html, /screen-params-form:/);
		assert.doesNotMatch(html, /recipe-props:/);
	});

	it("skips expensive prerender output generation during the build phase", async () => {
		recipePageState.config = {
			title: "Weather",
		};
		const { isBuildPhase, renderRecipeOutputs } = await import(
			"@/lib/recipes/recipe-renderer"
		);
		vi.mocked(isBuildPhase).mockReturnValue(true);

		const module = await getModule();
		const html = await renderAsync(
			await module.default({
				params: Promise.resolve({ slug: "weather" }),
				searchParams: Promise.resolve({}),
			}),
		);

		assert.doesNotMatch(html, /render:bitmap/);
		assert.doesNotMatch(html, /render:png/);
		assert.equal(vi.mocked(renderRecipeOutputs).mock.calls.length, 0);
	});

	it("shows a liquid render failure state and skips screen params when no custom fields exist", async () => {
		recipePageState.config = null;
		recipePageState.liquidMeta = {
			name: "Liquid Weather",
			description: null,
			category: null,
			version: null,
			updated_at: null,
		};
		recipePageState.liquidSettings = {
			custom_fields: [] as unknown[],
		};
		const { renderLiquidRecipe } = await import(
			"@/lib/recipes/liquid-renderer"
		);
		vi.mocked(renderLiquidRecipe).mockResolvedValue(null);

		const module = await getModule();
		const html = await renderAsync(
			await module.default({
				params: Promise.resolve({ slug: "liquid-weather" }),
				searchParams: Promise.resolve({}),
			}),
		);

		assert.match(html, /Failed to render liquid template/);
		assert.doesNotMatch(html, /screen-params-form:/);
	});

	it("handles unavailable liquid metadata", async () => {
		recipePageState.config = {
			title: "Weather",
		};
		const { fetchRecipeConfig } = await import("@/lib/recipes/recipe-renderer");
		const { checkDbConnection } = await import("@/lib/database/utils");

		const module = await getModule();
		const reactHtml = await renderAsync(
			await module.default({
				params: Promise.resolve({ slug: "weather" }),
				searchParams: Promise.resolve({ format: "react" }),
			}),
		);
		assert.match(reactHtml, /preview-stage:weather/);

		vi.mocked(fetchRecipeConfig).mockResolvedValueOnce(null);
		vi.mocked(checkDbConnection).mockResolvedValueOnce({ ready: false });
		await assert.rejects(
			async () =>
				renderAsync(
					await module.default({
						params: Promise.resolve({ slug: "liquid-weather" }),
						searchParams: Promise.resolve({}),
					}),
				),
			/NOT_FOUND/,
		);
	});

	it("calls notFound when neither react nor liquid recipe exists", async () => {
		const module = await getModule();

		await assert.rejects(
			async () =>
				renderAsync(
					await module.default({
						params: Promise.resolve({ slug: "missing" }),
						searchParams: Promise.resolve({}),
					}),
				),
			/NOT_FOUND/,
		);
		assert.equal(recipePageState.notFoundCalls, 1);
	});
});
