import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

type RecipeMetadataRow =
	| { metadata: string | Record<string, unknown> }
	| undefined;

async function loadModule(options?: {
	dbReady?: boolean;
	recipeMetadata?: RecipeMetadataRow;
	isLiquidRecipe?: boolean;
	liquidSettings?: { custom_fields?: Array<Record<string, unknown>> } | null;
	liquidRenderResult?: { html: string } | null;
	screenParams?: Record<string, unknown>;
	rendererType?: string;
	getDataResult?: Record<string, unknown> | null;
	getDataRejects?: Error | null;
	renderHtmlRejects?: Error | null;
	renderBmpRejects?: Error | null;
	missingComponent?: boolean;
	nodeEnv?: string;
	nextPhase?: string;
}) {
	vi.resetModules();
	vi.unstubAllEnvs();

	if (options?.nodeEnv) {
		vi.stubEnv("NODE_ENV", options.nodeEnv);
	}

	if (options?.nextPhase) {
		vi.stubEnv("NEXT_PHASE", options.nextPhase);
	}

	if (options?.rendererType) {
		vi.stubEnv("REACT_RENDERER", options.rendererType);
	}

	const state = {
		dbReady: options?.dbReady ?? true,
		recipeMetadata: options?.recipeMetadata,
		isLiquidRecipe: options?.isLiquidRecipe ?? false,
		liquidSettings: options?.liquidSettings ?? null,
		liquidRenderResult: options?.liquidRenderResult ?? null,
		screenParams: options?.screenParams ?? {},
	};

	const recipeComponent = vi.fn(() =>
		React.createElement("section", null, "recipe"),
	);
	const notFoundComponent = vi.fn(({ slug }: { slug: string }) =>
		React.createElement("div", { slug }, `missing:${slug}`),
	);
	const renderHtmlToImageMock =
		options?.renderHtmlRejects instanceof Error
			? vi.fn().mockRejectedValue(options.renderHtmlRejects)
			: vi.fn().mockResolvedValue(Buffer.from("html-png"));
	const renderBmpMock =
		options?.renderBmpRejects instanceof Error
			? vi.fn().mockRejectedValue(options.renderBmpRejects)
			: vi.fn().mockResolvedValue(Buffer.from("bitmap"));
	const renderWithSatoriMock = vi
		.fn()
		.mockResolvedValue(Buffer.from("satori-png"));
	const renderWithTakumiMock = vi
		.fn()
		.mockResolvedValue(Buffer.from("takumi-png"));
	const renderWithBrowserMock = vi
		.fn()
		.mockResolvedValue(Buffer.from("browser-png"));
	const sharpToBufferMock = vi
		.fn()
		.mockResolvedValue(Buffer.from("resized-png"));
	const sharpResizeMock = vi.fn(() => ({
		png: vi.fn(() => ({ toBuffer: sharpToBufferMock })),
	}));
	const sharpMock = vi.fn(() => ({
		resize: sharpResizeMock,
	}));
	const getScreenParamsMock = vi.fn().mockResolvedValue(state.screenParams);
	const customFieldsToParamDefinitionsMock = vi.fn(() => ({
		city: { label: "City", type: "string" },
	}));
	const fetchLiquidRecipeSettingsMock = vi
		.fn()
		.mockResolvedValue(state.liquidSettings);
	const renderLiquidRecipeMock = vi
		.fn()
		.mockResolvedValue(state.liquidRenderResult);
	const isLiquidRecipeMock = vi.fn().mockResolvedValue(state.isLiquidRecipe);
	const logger = {
		error: vi.fn(),
		warn: vi.fn(),
	};

	const runQueryBuilder = {
		select: vi.fn(() => runQueryBuilder),
		where: vi.fn(() => runQueryBuilder),
		executeTakeFirst: vi.fn(async () => state.recipeMetadata),
	};
	const mockDb = {
		selectFrom: vi.fn(() => runQueryBuilder),
	};
	const withExplicitUserScopeMock = vi.fn(async (_userId, runQuery) =>
		runQuery(mockDb),
	);

	vi.doMock("sharp", () => ({
		default: sharpMock,
	}));
	vi.doMock("@/app/(app)/recipes/screens/not-found/not-found", () => ({
		default: notFoundComponent,
	}));
	vi.doMock("@/app/actions/screens-params", () => ({
		getScreenParams: getScreenParamsMock,
	}));
	vi.doMock("@/lib/database/db", () => ({ db: mockDb }));
	vi.doMock("@/lib/database/scoped-db", () => ({
		withExplicitUserScope: withExplicitUserScopeMock,
	}));
	vi.doMock("@/lib/database/utils", () => ({
		checkDbConnection: vi.fn(async () => ({ ready: state.dbReady })),
	}));
	vi.doMock("@/lib/recipes/html-screenshot", () => ({
		renderHtmlToImage: renderHtmlToImageMock,
	}));
	vi.doMock("@/lib/recipes/liquid-renderer", () => ({
		customFieldsToParamDefinitions: customFieldsToParamDefinitionsMock,
		fetchLiquidRecipeSettings: fetchLiquidRecipeSettingsMock,
		isLiquidRecipe: isLiquidRecipeMock,
		renderLiquidRecipe: renderLiquidRecipeMock,
	}));
	vi.doMock("@/lib/recipes/logger", () => ({ logger }));
	vi.doMock("@/utils/render-bmp", () => ({
		DitheringMethod: { JARVIS_JUDICE_NINKE: "JJN" },
		renderBmp: renderBmpMock,
	}));
	vi.doMock("./renderers/satori", () => ({
		renderWithSatori: renderWithSatoriMock,
	}));
	vi.doMock("./renderers/takumi", () => ({
		renderWithTakumi: renderWithTakumiMock,
	}));
	vi.doMock("./renderers/browser", () => ({
		renderWithBrowser: renderWithBrowserMock,
	}));
	vi.doMock("@/app/(app)/recipes/screens/not-found/not-found.tsx", () => ({
		default: recipeComponent,
	}));

	const weatherGetDataFactory = () => ({
		default: options?.getDataRejects
			? vi.fn().mockRejectedValue(options.getDataRejects)
			: vi.fn().mockResolvedValue(options?.getDataResult),
	});

	if (!options?.missingComponent) {
		vi.doMock("@/app/(app)/recipes/screens/weather/weather.tsx", () => ({
			default: recipeComponent,
		}));
	}

	if (options?.getDataRejects) {
		vi.doMock(
			"@/app/(app)/recipes/screens/weather/getData.ts",
			weatherGetDataFactory,
		);
		vi.doMock(
			"/Users/wooboo/.codex/worktrees/a923/byos_next/app/(app)/recipes/screens/weather/getData.ts",
			weatherGetDataFactory,
		);
	} else if (options?.getDataResult) {
		vi.doMock(
			"@/app/(app)/recipes/screens/weather/getData.ts",
			weatherGetDataFactory,
		);
		vi.doMock(
			"/Users/wooboo/.codex/worktrees/a923/byos_next/app/(app)/recipes/screens/weather/getData.ts",
			weatherGetDataFactory,
		);
	}

	const mod = await import("./recipe-renderer");
	return {
		...mod,
		recipeComponent,
		notFoundComponent,
		renderHtmlToImageMock,
		renderBmpMock,
		renderWithSatoriMock,
		renderWithTakumiMock,
		renderWithBrowserMock,
		sharpMock,
		sharpResizeMock,
		sharpToBufferMock,
		getScreenParamsMock,
		customFieldsToParamDefinitionsMock,
		fetchLiquidRecipeSettingsMock,
		renderLiquidRecipeMock,
		isLiquidRecipeMock,
		logger,
		mockDb,
		runQueryBuilder,
		withExplicitUserScopeMock,
	};
}

describe("recipe-renderer helpers", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("derives renderer type and image sizing from config and environment", async () => {
		const { addDimensionsToProps, getRecipeImageOptions, getRendererType } =
			await loadModule({ rendererType: "satori" });

		expect(getRendererType()).toBe("satori");
		expect(getRecipeImageOptions({ title: "Demo" }, 400, 240)).toEqual({
			width: 400,
			height: 240,
		});
		expect(addDimensionsToProps({ existing: true }, 800, 480)).toEqual({
			existing: true,
			width: 800,
			height: 480,
		});
		expect(
			getRecipeImageOptions(
				{ title: "Demo", renderSettings: { doubleSizeForSharperText: true } },
				400,
				240,
			),
		).toEqual({ width: 800, height: 480 });
	});

	it("detects build phase from NEXT_PHASE", async () => {
		const { isBuildPhase } = await loadModule({
			nextPhase: "phase-production-build",
		});

		expect(isBuildPhase()).toBe(true);
	});

	it("returns null when the database is not ready", async () => {
		const { fetchRecipeConfig, mockDb } = await loadModule({ dbReady: false });

		const config = await fetchRecipeConfig("draft");

		expect(config).toBeNull();
		expect(mockDb.selectFrom).not.toHaveBeenCalled();
	});

	it("uses explicit user scope and supports object metadata", async () => {
		const { fetchRecipeConfig, withExplicitUserScopeMock } = await loadModule({
			recipeMetadata: {
				metadata: { title: "Scoped", published: true },
			},
		});

		const config = await fetchRecipeConfig("scoped", "user-1");

		expect(withExplicitUserScopeMock).toHaveBeenCalledWith(
			"user-1",
			expect.any(Function),
		);
		expect(config).toEqual({ title: "Scoped", published: true });
	});

	it("hides unpublished react recipes in production", async () => {
		const { fetchRecipeConfig } = await loadModule({
			nodeEnv: "production",
			recipeMetadata: {
				metadata: JSON.stringify({ title: "Draft", published: false }),
			},
		});

		const config = await fetchRecipeConfig("draft");

		expect(config).toBeNull();
	});

	it("logs and returns null when the recipe component cannot be loaded", async () => {
		const { fetchRecipeComponent, logger } = await loadModule({
			missingComponent: true,
		});

		const component = await fetchRecipeComponent("missing");

		expect(component).toBeNull();
		expect(logger.error).toHaveBeenCalledWith(
			"Error loading component for missing:",
			expect.any(Error),
		);
	});

	it("returns base props during build phase", async () => {
		const { fetchRecipeProps } = await loadModule({
			nextPhase: "phase-production-build",
			screenParams: { city: "Warsaw" },
		});

		const props = await fetchRecipeProps("weather", {
			title: "Weather",
			hasDataFetch: true,
			props: { theme: "dark" },
			params: { city: { label: "City", type: "string" } },
		});

		expect(props).toEqual({
			theme: "dark",
			params: { city: "Warsaw" },
		});
	});

	it("replaces props with fetched data when validation passes", async () => {
		const { fetchRecipeProps } = await loadModule({
			screenParams: { city: "Warsaw" },
			getDataResult: { forecast: "sunny" },
		});

		const props = await fetchRecipeProps(
			"weather",
			{
				title: "Weather",
				hasDataFetch: true,
				props: { theme: "dark" },
				params: { city: { label: "City", type: "string" } },
			},
			{
				validateFetchedData: (_slug, data) => "forecast" in (data as object),
			},
		);

		expect(props).toEqual({ forecast: "sunny" });
	});

	it("warns and falls back when fetched data is invalid", async () => {
		const { fetchRecipeProps, logger } = await loadModule({
			screenParams: { city: "Warsaw" },
			getDataResult: { forecast: "sunny" },
		});

		const props = await fetchRecipeProps(
			"weather",
			{
				title: "Weather",
				hasDataFetch: true,
				props: { theme: "dark" },
				params: { city: { label: "City", type: "string" } },
			},
			{
				validateFetchedData: () => false,
			},
		);

		expect(props).toEqual({
			theme: "dark",
			params: { city: "Warsaw" },
		});
		expect(logger.warn).toHaveBeenCalledWith(
			"Invalid or missing data for weather",
		);
	});

	it("logs and falls back when data fetching throws", async () => {
		const { fetchRecipeProps, logger } = await loadModule({
			screenParams: { city: "Warsaw" },
			getDataRejects: new Error("boom"),
		});

		const props = await fetchRecipeProps("weather", {
			title: "Weather",
			hasDataFetch: true,
			props: { theme: "dark" },
			params: { city: { label: "City", type: "string" } },
		});

		expect(props).toEqual({
			theme: "dark",
			params: { city: "Warsaw" },
		});
		expect(logger.error).toHaveBeenCalledWith(
			"Data fetch error for weather:",
			expect.any(Error),
		);
	});
});

describe("buildRecipeElement", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("builds a react recipe from stored metadata and screen params", async () => {
		const { buildRecipeElement } = await loadModule({
			recipeMetadata: {
				metadata: JSON.stringify({
					title: "Not Found",
					published: true,
					params: { city: { label: "City", type: "string" } },
					hasDataFetch: false,
					props: { theme: "dark" },
				}),
			},
			screenParams: { city: "Warsaw" },
		});

		const result = await buildRecipeElement({ slug: "not-found" });

		expect(result.config?.title).toBe("Not Found");
		expect(result.Component).toBeTypeOf("function");
		expect(result.props).toEqual({
			theme: "dark",
			params: { city: "Warsaw" },
		});
		expect(result.html).toBeUndefined();
		expect(result.element?.props).toEqual({
			theme: "dark",
			params: { city: "Warsaw" },
		});
	});

	it("returns a not-found element when validateProps rejects the result", async () => {
		const { buildRecipeElement } = await loadModule({
			recipeMetadata: {
				metadata: JSON.stringify({
					title: "Weather",
					published: true,
					hasDataFetch: false,
				}),
			},
		});

		const result = await buildRecipeElement({
			slug: "weather",
			validateProps: () => false,
		});

		expect(result.Component).toBeNull();
		expect(result.props).toEqual({});
		expect(result.element?.props).toEqual({ slug: "weather" });
	});

	it("falls back to a liquid recipe and loads custom field overrides from screen params", async () => {
		const {
			buildRecipeElement,
			getScreenParamsMock,
			customFieldsToParamDefinitionsMock,
			renderLiquidRecipeMock,
		} = await loadModule({
			isLiquidRecipe: true,
			liquidSettings: {
				custom_fields: [{ keyname: "city", default: "Paris" }],
			},
			liquidRenderResult: {
				html: "<main>liquid</main>",
			},
			screenParams: { city: "Warsaw" },
		});

		const result = await buildRecipeElement({ slug: "liquid-card" });

		expect(customFieldsToParamDefinitionsMock).toHaveBeenCalledWith([
			{ keyname: "city", default: "Paris" },
		]);
		expect(getScreenParamsMock).toHaveBeenCalledWith(
			"liquid-card",
			expect.any(Object),
			undefined,
		);
		expect(renderLiquidRecipeMock).toHaveBeenCalledWith(
			"liquid-card",
			{ city: "Warsaw" },
			undefined,
		);
		expect(result).toEqual({
			config: null,
			Component: null,
			props: {},
			html: "<main>liquid</main>",
			element: null,
		});
	});

	it("returns not-found when liquid rendering returns nothing", async () => {
		const { buildRecipeElement } = await loadModule({
			isLiquidRecipe: true,
			liquidRenderResult: null,
		});

		const result = await buildRecipeElement({ slug: "liquid-card" });

		expect(result).toEqual({
			config: null,
			Component: null,
			props: {},
			element: expect.objectContaining({
				props: { slug: "liquid-card" },
			}),
		});
	});

	it("returns not-found when neither react nor liquid recipes exist", async () => {
		const { buildRecipeElement } = await loadModule();

		const result = await buildRecipeElement({ slug: "missing" });

		expect(result).toEqual({
			config: null,
			Component: null,
			props: {},
			element: expect.objectContaining({
				props: { slug: "missing" },
			}),
		});
	});
});

describe("renderRecipeOutputs and renderRecipeToImage", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("returns empty results when no output formats are requested", async () => {
		const { renderRecipeOutputs } = await loadModule();

		const result = await renderRecipeOutputs({
			slug: "noop",
			config: null,
			imageWidth: 10,
			imageHeight: 10,
			formats: [],
		});

		expect(result).toEqual({
			png: null,
			bitmap: null,
		});
	});

	it("logs and returns empty results when html and component are both missing", async () => {
		const { renderRecipeOutputs, logger } = await loadModule();

		const result = await renderRecipeOutputs({
			slug: "noop",
			config: null,
			imageWidth: 10,
			imageHeight: 10,
			formats: ["png"],
		});

		expect(result).toEqual({
			png: null,
			bitmap: null,
		});
		expect(logger.error).toHaveBeenCalledWith(
			"No Component or html provided for noop",
		);
	});

	it("renders HTML to resized PNG and bitmap outputs", async () => {
		const {
			renderRecipeOutputs,
			renderHtmlToImageMock,
			sharpMock,
			sharpResizeMock,
			renderBmpMock,
		} = await loadModule();

		const result = await renderRecipeOutputs({
			slug: "liquid-card",
			html: "<main>liquid</main>",
			config: {
				title: "Liquid card",
				renderSettings: {
					doubleSizeForSharperText: true,
					applyEdgeSnap: false,
				},
			},
			imageWidth: 400,
			imageHeight: 240,
			formats: ["png", "bitmap"],
			grayscale: 4,
		});

		expect(renderHtmlToImageMock).toHaveBeenCalledWith(
			"<main>liquid</main>",
			800,
			480,
		);
		expect(sharpMock).toHaveBeenCalledWith(Buffer.from("html-png"));
		expect(sharpResizeMock).toHaveBeenCalledWith(400, 240);
		expect(renderBmpMock).toHaveBeenCalledWith(Buffer.from("html-png"), {
			ditheringMethod: "JJN",
			width: 400,
			height: 240,
			applyEdgeSnap: false,
			grayscale: 4,
		});
		expect(result).toEqual({
			png: Buffer.from("resized-png"),
			bitmap: Buffer.from("bitmap"),
		});
	});

	it("routes component rendering through satori", async () => {
		const { renderRecipeOutputs, renderWithSatoriMock } = await loadModule({
			rendererType: "satori",
		});

		const component = ({
			width,
			height,
		}: {
			width?: number;
			height?: number;
		}) => React.createElement("div", null, `${width}x${height}`);

		const result = await renderRecipeOutputs({
			slug: "weather",
			Component: component,
			props: { width: 300, height: 200 },
			config: { title: "Satori render" },
			imageWidth: 300,
			imageHeight: 200,
			formats: ["png"],
		});

		expect(renderWithSatoriMock).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			png: Buffer.from("satori-png"),
			bitmap: null,
		});
	});

	it("routes component rendering through the browser renderer when requested", async () => {
		const { renderRecipeOutputs, renderWithBrowserMock } = await loadModule({
			rendererType: "browser",
		});

		const component = ({
			width,
			height,
		}: {
			width?: number;
			height?: number;
		}) => React.createElement("div", null, `${width}x${height}`);

		const result = await renderRecipeOutputs({
			slug: "not-found",
			Component: component,
			props: { width: 300, height: 200 },
			config: {
				title: "Browser render",
				renderSettings: { doubleSizeForSharperText: true },
			},
			imageWidth: 300,
			imageHeight: 200,
			formats: ["png"],
			cookies: "session=abc",
		});

		expect(renderWithBrowserMock).toHaveBeenCalledWith(
			"not-found",
			300,
			200,
			"session=abc",
			undefined,
		);
		expect(result).toEqual({
			png: Buffer.from("browser-png"),
			bitmap: null,
		});
	});

	it("logs and returns empty results when png generation fails", async () => {
		const { renderRecipeOutputs, logger } = await loadModule({
			renderHtmlRejects: new Error("png failed"),
		});

		const result = await renderRecipeOutputs({
			slug: "liquid-card",
			html: "<main>liquid</main>",
			config: null,
			imageWidth: 100,
			imageHeight: 60,
		});

		expect(result).toEqual({
			png: null,
			bitmap: null,
		});
		expect(logger.error).toHaveBeenCalledWith(
			"Error generating PNG for liquid-card:",
			expect.any(Error),
		);
	});

	it("logs bitmap conversion failures but still returns the png", async () => {
		const { renderRecipeOutputs, logger } = await loadModule({
			renderBmpRejects: new Error("bitmap failed"),
		});

		const result = await renderRecipeOutputs({
			slug: "liquid-card",
			html: "<main>liquid</main>",
			config: null,
			imageWidth: 100,
			imageHeight: 60,
			formats: ["png", "bitmap"],
		});

		expect(result).toEqual({
			png: Buffer.from("html-png"),
			bitmap: null,
		});
		expect(logger.error).toHaveBeenCalledWith(
			"Error generating bitmap for liquid-card:",
			expect.any(Error),
		);
	});

	it("renders liquid recipes end-to-end via renderRecipeToImage", async () => {
		const { renderRecipeToImage, renderHtmlToImageMock, renderBmpMock } =
			await loadModule({
				isLiquidRecipe: true,
				liquidRenderResult: { html: "<main>preview</main>" },
			});

		const result = await renderRecipeToImage({
			slug: "liquid-card",
			imageWidth: 320,
			imageHeight: 200,
			formats: ["png", "bitmap"],
		});

		expect(renderHtmlToImageMock).toHaveBeenCalledWith(
			"<main>preview</main>",
			320,
			200,
		);
		expect(renderBmpMock).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			png: Buffer.from("html-png"),
			bitmap: Buffer.from("bitmap"),
		});
	});

	it("renders not-found recipes through the fallback component path", async () => {
		const { renderRecipeToImage, renderWithTakumiMock } = await loadModule();

		const result = await renderRecipeToImage({
			slug: "missing",
			imageWidth: 320,
			imageHeight: 200,
			formats: ["png"],
		});

		expect(renderWithTakumiMock).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			png: Buffer.from("takumi-png"),
			bitmap: null,
		});
	});
});
