import React, { cache, createElement } from "react";
import sharp from "sharp";
import NotFoundScreen from "@/app/(app)/recipes/screens/not-found/not-found";
import { getScreenParams } from "@/app/actions/screens-params";
import { db } from "@/lib/database/db";
import { withExplicitUserScope } from "@/lib/database/scoped-db";
import { checkDbConnection } from "@/lib/database/utils";
import { renderHtmlToImage } from "@/lib/recipes/html-screenshot";
import {
	customFieldsToParamDefinitions,
	fetchLiquidRecipeSettings,
	isLiquidRecipe,
	renderLiquidRecipe,
} from "@/lib/recipes/liquid-renderer";
import { logger } from "@/lib/recipes/logger";
import type { RecipeParamDefinitions } from "@/lib/recipes/params";
import type { RgbPalette } from "@/utils/image-processing";
import { DitheringMethod, renderBmp } from "@/utils/render-bmp";
import { renderWithSatori } from "./renderers/satori";
import { renderWithTakumi } from "./renderers/takumi";

export { logger } from "@/lib/recipes/logger";
export type {
	RecipeParamDefinition,
	RecipeParamDefinitions,
} from "@/lib/recipes/params";

export type ComponentProps = Record<string, unknown> & {
	width?: number;
	height?: number;
};

type RecipeComponentModule = {
	default: React.ComponentType<ComponentProps>;
};

type RecipeDataModule = {
	default: (params?: Record<string, unknown>) => Promise<ComponentProps>;
};

const asRecipeComponentModule = (module: Promise<unknown>) =>
	module as Promise<RecipeComponentModule>;

const asRecipeDataModule = (module: Promise<unknown>) =>
	module as Promise<RecipeDataModule>;

const recipeComponentImporters: Record<
	string,
	() => Promise<RecipeComponentModule>
> = {
	album: () =>
		asRecipeComponentModule(import("@/app/(app)/recipes/screens/album/album")),
	"bitcoin-price": () =>
		asRecipeComponentModule(
			import("@/app/(app)/recipes/screens/bitcoin-price/bitcoin-price"),
		),
	"bitmap-patterns": () =>
		asRecipeComponentModule(
			import("@/app/(app)/recipes/screens/bitmap-patterns/bitmap-patterns"),
		),
	"calendar-daily": () =>
		asRecipeComponentModule(
			import("@/app/(app)/recipes/screens/calendar-daily/calendar-daily"),
		),
	"calendar-monthly": () =>
		asRecipeComponentModule(
			import("@/app/(app)/recipes/screens/calendar-monthly/calendar-monthly"),
		),
	"calendar-weekly": () =>
		asRecipeComponentModule(
			import("@/app/(app)/recipes/screens/calendar-weekly/calendar-weekly"),
		),
	"calibration-square": () =>
		asRecipeComponentModule(
			import(
				"@/app/(app)/recipes/screens/calibration-square/calibration-square"
			),
		),
	"color-calibration": () =>
		asRecipeComponentModule(
			import("@/app/(app)/recipes/screens/color-calibration/color-calibration"),
		),
	"immich-favorites": () =>
		asRecipeComponentModule(
			import("@/app/(app)/recipes/screens/immich-favorites/immich-favorites"),
		),
	"not-found": () =>
		asRecipeComponentModule(
			import("@/app/(app)/recipes/screens/not-found/not-found"),
		),
	"responsive-example": () =>
		asRecipeComponentModule(
			import(
				"@/app/(app)/recipes/screens/responsive-example/responsive-example"
			),
		),
	"school-schedule": () =>
		asRecipeComponentModule(
			import("@/app/(app)/recipes/screens/school-schedule/school-schedule"),
		),
	"simple-text": () =>
		asRecipeComponentModule(
			import("@/app/(app)/recipes/screens/simple-text/simple-text"),
		),
	weather: () =>
		asRecipeComponentModule(
			import("@/app/(app)/recipes/screens/weather/weather"),
		),
	wikipedia: () =>
		asRecipeComponentModule(
			import("@/app/(app)/recipes/screens/wikipedia/wikipedia"),
		),
};

const recipeDataImporters: Record<string, () => Promise<RecipeDataModule>> = {
	"bitcoin-price": () =>
		asRecipeDataModule(
			import("@/app/(app)/recipes/screens/bitcoin-price/getData"),
		),
	"calendar-daily": () =>
		asRecipeDataModule(
			import("@/app/(app)/recipes/screens/calendar-daily/getData"),
		),
	"calendar-monthly": () =>
		asRecipeDataModule(
			import("@/app/(app)/recipes/screens/calendar-monthly/getData"),
		),
	"calendar-weekly": () =>
		asRecipeDataModule(
			import("@/app/(app)/recipes/screens/calendar-weekly/getData"),
		),
	"immich-favorites": () =>
		asRecipeDataModule(
			import("@/app/(app)/recipes/screens/immich-favorites/getData"),
		),
	"school-schedule": () =>
		asRecipeDataModule(
			import("@/app/(app)/recipes/screens/school-schedule/getData"),
		),
	weather: () =>
		asRecipeDataModule(import("@/app/(app)/recipes/screens/weather/getData")),
	wikipedia: () =>
		asRecipeDataModule(import("@/app/(app)/recipes/screens/wikipedia/getData")),
};

export type RecipeConfig = {
	title: string;
	published?: boolean;
	description?: string;
	componentPath?: string;
	hasDataFetch?: boolean;
	props?: Record<string, unknown>;
	params?: RecipeParamDefinitions;
	tags?: string[];
	renderSettings?: {
		doubleSizeForSharperText?: boolean;
		applyEdgeSnap?: boolean;
		ditheringMethod?: DitheringMethod;
		bayerPatternSize?: 2 | 4 | 8;
		colorSaturation?: number;
		[key: string]: boolean | string | number | undefined;
	};
	[key: string]: unknown;
};

// Re-export constants from shared file
export { DEFAULT_IMAGE_HEIGHT, DEFAULT_IMAGE_WIDTH } from "./constants";

// Utility to check if we're in build phase
export const isBuildPhase = (): boolean =>
	process.env.NEXT_PHASE === "phase-production-build";

// Helper to add dimensions to props
export const addDimensionsToProps = (
	props: ComponentProps,
	width: number,
	height: number,
): ComponentProps => ({
	...props,
	width,
	height,
});

// Get renderer type from environment variable (defaults to "takumi")
export const getRendererType = (): "takumi" | "satori" | "browser" => {
	const renderer = process.env.REACT_RENDERER?.toLowerCase();
	if (renderer === "satori") return "satori";
	if (renderer === "browser") return "browser";
	return "takumi";
};

export const fetchRecipeConfig = cache(
	async (slug: string, userId?: string): Promise<RecipeConfig | null> => {
		const { ready } = await checkDbConnection();
		if (!ready) return null;

		const runQuery = (conn: typeof db, sharedOnly = false) => {
			let query = conn
				.selectFrom("recipes")
				.select(["metadata"])
				.where("slug", "=", slug)
				.where("type", "=", "react");

			if (sharedOnly) {
				query = query.where("user_id", "is", null);
			}

			return query.executeTakeFirst();
		};

		const row = userId
			? await withExplicitUserScope(userId, runQuery)
			: await runQuery(db, true);

		if (!row?.metadata) return null;

		const config =
			typeof row.metadata === "string"
				? (JSON.parse(row.metadata) as RecipeConfig)
				: (row.metadata as unknown as RecipeConfig);

		if (!config.published && process.env.NODE_ENV === "production") {
			return null;
		}

		return config;
	},
);

export const fetchRecipeComponent = cache(async (slug: string) => {
	try {
		const importer = recipeComponentImporters[slug];
		if (!importer) {
			throw new Error(`Unknown recipe component: ${slug}`);
		}

		const { default: Component } = await importer();
		return Component;
	} catch (error) {
		logger.error(`Error loading component for ${slug}:`, error);
		return null;
	}
});

type FetchPropsOptions = {
	validateFetchedData?: (slug: string, data: unknown) => boolean;
};

export const fetchRecipeProps = cache(
	async (
		slug: string,
		config: RecipeConfig,
		options?: FetchPropsOptions,
		userId?: string,
		paramsOverride?: Record<string, unknown>,
	): Promise<ComponentProps> => {
		const params =
			paramsOverride ??
			(config.params ? await getScreenParams(slug, config.params, userId) : {});

		let props: ComponentProps = {
			...(config.props || {}),
			...(Object.keys(params).length > 0 ? { params } : {}),
		};

		if (isBuildPhase()) {
			return props;
		}

		if (!config.hasDataFetch) {
			return props;
		}

		try {
			const importer = recipeDataImporters[slug];
			if (!importer) {
				logger.warn(`Missing data fetcher for ${slug}`);
				return props;
			}

			const { default: fetchDataFunction } = await importer();

			// Set a timeout for data fetching to prevent hanging
			const fetchPromise = fetchDataFunction(params);
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error("Data fetch timeout")), 10000);
			});

			// Race between the fetch and the timeout
			const fetchedData = await Promise.race([
				fetchPromise,
				timeoutPromise,
			]).catch((error) => {
				logger.error(`Data fetch error for ${slug}:`, error);
				return null;
			});

			// Validate fetched data when a validator is provided
			const isValid =
				fetchedData &&
				typeof fetchedData === "object" &&
				(!options?.validateFetchedData ||
					options.validateFetchedData(slug, fetchedData));

			if (isValid) {
				props = fetchedData as ComponentProps;
			} else {
				logger.warn(`Invalid or missing data for ${slug}`);
			}
		} catch (error) {
			logger.error(`Error fetching data for ${slug}:`, error);
		}

		return props;
	},
);

export const getRecipeImageOptions = (
	config: RecipeConfig | null,
	width: number,
	height: number,
) => {
	const useDoubling = config?.renderSettings?.doubleSizeForSharperText ?? false;
	const scaleFactor = useDoubling ? 2 : 1;

	return {
		width: width * scaleFactor,
		height: height * scaleFactor,
	};
};

const DITHERING_METHOD_PARAM_ALIASES: Record<string, DitheringMethod> = {
	atkinson: DitheringMethod.ATKINSON,
	bayer: DitheringMethod.BAYER,
	"floyd-steinberg": DitheringMethod.FLOYD_STEINBERG,
	floyd: DitheringMethod.FLOYD_STEINBERG,
	fs: DitheringMethod.FLOYD_STEINBERG,
	"jarvis-judice-ninke": DitheringMethod.JARVIS_JUDICE_NINKE,
	jarvis: DitheringMethod.JARVIS_JUDICE_NINKE,
	jjn: DitheringMethod.JARVIS_JUDICE_NINKE,
	none: DitheringMethod.NONE,
	random: DitheringMethod.RANDOM,
	threshold: DitheringMethod.THRESHOLD,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNumberParam(value: unknown): number | undefined {
	if (typeof value === "number")
		return Number.isFinite(value) ? value : undefined;
	if (typeof value !== "string") return undefined;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveDitheringMethodParam(
	params?: Record<string, unknown>,
): DitheringMethod | undefined {
	const value = params?.ditheringMethod ?? params?.dithering;
	if (typeof value !== "string") return undefined;
	return DITHERING_METHOD_PARAM_ALIASES[value.trim().toLowerCase()];
}

function resolveBayerPatternSizeParam(
	params?: Record<string, unknown>,
): 2 | 4 | 8 | undefined {
	const value = parseNumberParam(params?.bayerPatternSize ?? params?.bayer);
	return value === 2 || value === 4 || value === 8 ? value : undefined;
}

function resolveColorSaturationParam(
	params?: Record<string, unknown>,
): number | undefined {
	const value = parseNumberParam(params?.colorSaturation ?? params?.saturation);
	if (value === undefined || value < 0 || value > 4) return undefined;
	return value;
}

function resolveBitmapRenderParams(params?: Record<string, unknown>) {
	const ditheringMethod = resolveDitheringMethodParam(params);
	const bayerPatternSize = resolveBayerPatternSizeParam(params);
	const colorSaturation = resolveColorSaturationParam(params);

	return {
		...(ditheringMethod ? { ditheringMethod } : {}),
		...(bayerPatternSize ? { bayerPatternSize } : {}),
		...(colorSaturation !== undefined ? { colorSaturation } : {}),
	};
}

type RenderFormats = Array<"bitmap" | "png">;

type RenderOptions = {
	slug: string;
	Component?: React.ComponentType<ComponentProps> | null;
	props?: ComponentProps;
	config: RecipeConfig | null;
	imageWidth: number;
	imageHeight: number;
	formats?: RenderFormats;
	grayscale?: number; // Number of gray levels: 2, 4, or 16
	palette?: RgbPalette;
	ditherPalette?: RgbPalette;
	ditherAnchorPalette?: RgbPalette;
	ditheringMethod?: DitheringMethod;
	bayerPatternSize?: 2 | 4 | 8;
	colorSaturation?: number;
	html?: string; // When set, uses Puppeteer screenshot instead of Takumi/Satori
	cookies?: string; // Cookie header to forward to browser renderer
	previewPath?: string; // Browser renderer route to capture
	previewBaseUrl?: string; // Same-origin base URL for authenticated browser previews
};

type RenderResults = {
	bitmap: Buffer | null;
	png: Buffer | null;
};

const getDefaultRenderResults = (): RenderResults => ({
	bitmap: null,
	png: null,
});

export const renderRecipeOutputs = cache(
	async ({
		slug,
		Component,
		props,
		config,
		imageWidth,
		imageHeight,
		formats = ["bitmap", "png"],
		grayscale,
		palette,
		ditherPalette,
		ditherAnchorPalette,
		ditheringMethod,
		bayerPatternSize,
		colorSaturation,
		html,
		cookies,
		previewPath,
		previewBaseUrl,
	}: RenderOptions): Promise<RenderResults> => {
		const results = getDefaultRenderResults();
		const needsPng = formats.includes("png");
		const needsBitmap = formats.includes("bitmap");

		if (!needsPng && !needsBitmap) return results;

		const rendererType = getRendererType();
		const imageOptions =
			rendererType === "browser"
				? { width: imageWidth, height: imageHeight }
				: getRecipeImageOptions(config, imageWidth, imageHeight);

		// Render PNG once and reuse it for png/bitmap outputs.
		let pngBuffer: Buffer;
		try {
			if (html) {
				pngBuffer = await renderHtmlToImage(
					html,
					imageOptions.width,
					imageOptions.height,
				);
			} else if (Component && props) {
				if (rendererType === "browser") {
					const { renderWithBrowser } = await import("./renderers/browser");
					pngBuffer = await renderWithBrowser(
						slug,
						imageWidth,
						imageHeight,
						cookies,
						previewPath,
						previewBaseUrl,
					);
				} else {
					const element = createElement(Component, props);
					pngBuffer =
						rendererType === "satori"
							? await renderWithSatori(
									element,
									imageOptions.width,
									imageOptions.height,
								)
							: await renderWithTakumi(
									element,
									imageOptions.width,
									imageOptions.height,
								);
				}
			} else {
				logger.error(`No Component or html provided for ${slug}`);
				return results;
			}
		} catch (error) {
			logger.error(`Error generating PNG for ${slug}:`, error);
			return results;
		}

		if (needsPng) {
			results.png =
				imageOptions.width !== imageWidth
					? await sharp(pngBuffer)
							.resize(imageWidth, imageHeight)
							.png()
							.toBuffer()
					: pngBuffer;
		}

		if (needsBitmap) {
			const resolvedBayerPatternSize =
				bayerPatternSize ?? config?.renderSettings?.bayerPatternSize;
			const resolvedColorSaturation =
				colorSaturation ?? config?.renderSettings?.colorSaturation;
			try {
				results.bitmap = await renderBmp(pngBuffer, {
					ditheringMethod:
						ditheringMethod ??
						config?.renderSettings?.ditheringMethod ??
						(palette
							? DitheringMethod.ATKINSON
							: DitheringMethod.JARVIS_JUDICE_NINKE),
					width: imageWidth,
					height: imageHeight,
					applyEdgeSnap: config?.renderSettings?.applyEdgeSnap ?? true,
					...(resolvedBayerPatternSize && {
						bayerPatternSize: resolvedBayerPatternSize,
					}),
					...(resolvedColorSaturation !== undefined
						? { colorSaturation: resolvedColorSaturation }
						: {}),
					...(grayscale !== undefined && { grayscale }),
					...(palette && { palette }),
					...(ditherPalette && { ditherPalette }),
					...(ditherAnchorPalette && { ditherAnchorPalette }),
				});
			} catch (error) {
				logger.error(`Error generating bitmap for ${slug}:`, error);
			}
		}

		return results;
	},
);

type BuildRecipeResult = {
	config: RecipeConfig | null;
	Component: React.ComponentType<ComponentProps> | null;
	props: ComponentProps;
	html?: string;
	element: React.ReactElement | null;
};

/**
 * Build a liquid recipe element by rendering the liquid template.
 */
async function buildLiquidRecipeElement(
	slug: string,
	userId?: string,
	paramsOverride?: Record<string, unknown>,
): Promise<BuildRecipeResult> {
	// Load stored custom field overrides from screen_configs
	let customFieldOverrides: Record<string, unknown> | undefined;
	const settings = await fetchLiquidRecipeSettings(slug, userId);
	if (settings?.custom_fields?.length) {
		const definitions = customFieldsToParamDefinitions(settings.custom_fields);
		customFieldOverrides =
			paramsOverride ?? (await getScreenParams(slug, definitions, userId));
	}

	const result = await renderLiquidRecipe(slug, customFieldOverrides, userId);

	if (!result) {
		return {
			config: null,
			Component: null,
			props: {},
			element: createElement(NotFoundScreen, { slug }),
		};
	}

	return {
		config: null,
		Component: null,
		props: {},
		html: result.html,
		element: null,
	};
}

export const buildRecipeElement = async ({
	slug,
	userId,
	validateProps,
	paramsOverride,
}: {
	slug: string;
	userId?: string | null;
	validateProps?: (slug: string, props: ComponentProps) => boolean;
	paramsOverride?: Record<string, unknown>;
}): Promise<BuildRecipeResult> => {
	// First try React recipe from the DB metadata cache.
	const config = await fetchRecipeConfig(slug, userId ?? undefined);
	const Component = config ? await fetchRecipeComponent(slug) : null;

	if (config && Component) {
		const props = await fetchRecipeProps(
			slug,
			config,
			{
				validateFetchedData: validateProps
					? (recipeSlug: string, data: unknown) => {
							return (
								typeof data === "object" &&
								data !== null &&
								validateProps(recipeSlug, data as ComponentProps)
							);
						}
					: undefined,
			},
			userId ?? undefined,
			paramsOverride,
		);

		if (validateProps && !validateProps(slug, props)) {
			return {
				config,
				Component: null,
				props,
				element: createElement(NotFoundScreen, { slug }),
			};
		}

		return {
			config,
			Component,
			props,
			element: createElement(Component, props),
		};
	}

	// Try liquid recipe from DB
	if (await isLiquidRecipe(slug, userId ?? undefined)) {
		return buildLiquidRecipeElement(slug, userId ?? undefined, paramsOverride);
	}

	// Not found
	return {
		config: null,
		Component: null,
		props: {},
		element: createElement(NotFoundScreen, { slug }),
	};
};

/**
 * High-level helper: resolve a recipe (react or liquid) and render to image outputs.
 * Encapsulates buildRecipeElement + renderRecipeOutputs so API routes don't
 * need to branch on recipe type.
 */
export async function renderRecipeToImage({
	slug,
	imageWidth,
	imageHeight,
	formats = ["bitmap", "png"],
	grayscale,
	palette,
	ditherPalette,
	ditherAnchorPalette,
	ditheringMethod,
	bayerPatternSize,
	colorSaturation,
	userId,
	cookies,
	paramsOverride,
	previewPath,
	previewBaseUrl,
}: {
	slug: string;
	imageWidth: number;
	imageHeight: number;
	formats?: RenderFormats;
	grayscale?: number;
	palette?: RgbPalette;
	ditherPalette?: RgbPalette;
	ditherAnchorPalette?: RgbPalette;
	ditheringMethod?: DitheringMethod;
	bayerPatternSize?: 2 | 4 | 8;
	colorSaturation?: number;
	userId?: string | null;
	cookies?: string;
	paramsOverride?: Record<string, unknown>;
	previewPath?: string;
	previewBaseUrl?: string;
}): Promise<RenderResults> {
	const result = await buildRecipeElement({ slug, userId, paramsOverride });
	const paramsFromProps = isRecord(result.props.params)
		? result.props.params
		: undefined;
	const bitmapRenderParams = resolveBitmapRenderParams(
		paramsOverride ?? paramsFromProps,
	);
	const resolvedDitheringMethod =
		ditheringMethod ?? bitmapRenderParams.ditheringMethod;
	const resolvedBayerPatternSize =
		bayerPatternSize ?? bitmapRenderParams.bayerPatternSize;
	const resolvedColorSaturation =
		colorSaturation ?? bitmapRenderParams.colorSaturation;

	if (result.html) {
		return renderRecipeOutputs({
			slug,
			html: result.html,
			config: null,
			imageWidth,
			imageHeight,
			formats,
			grayscale,
			palette,
			ditherPalette,
			ditherAnchorPalette,
			ditheringMethod: resolvedDitheringMethod,
			bayerPatternSize: resolvedBayerPatternSize,
			colorSaturation: resolvedColorSaturation,
			cookies,
			previewBaseUrl,
		});
	}

	const ComponentToRender = result.Component ?? (() => result.element);
	const propsWithDimensions = addDimensionsToProps(
		result.props,
		imageWidth,
		imageHeight,
	);

	return renderRecipeOutputs({
		slug,
		Component: ComponentToRender,
		props: propsWithDimensions,
		config: result.config,
		imageWidth,
		imageHeight,
		formats,
		grayscale,
		palette,
		ditherPalette,
		ditherAnchorPalette,
		ditheringMethod: resolvedDitheringMethod,
		bayerPatternSize: resolvedBayerPatternSize,
		colorSaturation: resolvedColorSaturation,
		cookies,
		previewPath,
		previewBaseUrl,
	});
}
