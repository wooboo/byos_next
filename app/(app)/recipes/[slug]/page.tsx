import { revalidateTag } from "next/cache";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense, use } from "react";
import { fetchRecipes } from "@/app/actions/mixup";
import {
	getScreenParams,
	updateScreenParams,
} from "@/app/actions/screens-params";
import { PageTemplate } from "@/components/common/page-template";
import {
	EmptyRenderState,
	RenderLoadingState,
	RenderOutputForFormat,
	ScaledRenderPreview,
} from "@/components/preview/render-output-preview";
import { DeleteRecipeButton } from "@/components/recipes/delete-recipe-button";
import { RecipePreviewStage } from "@/components/recipes/recipe-preview-stage";
import RecipeProps from "@/components/recipes/recipe-props";
import { ScreenParamsForm } from "@/components/recipes/screen-params-form";
import { Badge } from "@/components/ui/badge";
import { withUserScope } from "@/lib/database/scoped-db";
import { checkDbConnection } from "@/lib/database/utils";
import LiquidPreview from "@/lib/recipes/liquid-preview";
import {
	customFieldsToParamDefinitions,
	fetchLiquidRecipeSettings,
	renderLiquidRecipe,
} from "@/lib/recipes/liquid-renderer";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
	fetchRecipeConfig,
	fetchRecipeProps,
	getRendererType,
	RecipeConfig,
	renderRecipeOutputs,
} from "@/lib/recipes/recipe-renderer";

export async function generateMetadata() {
	return {};
}

async function refreshData(slug: string) {
	"use server";
	await new Promise((resolve) => setTimeout(resolve, 500));
	revalidateTag(slug, "max");
}

export async function generateStaticParams() {
	try {
		const recipes = await fetchRecipes();
		if (recipes.length > 0) {
			return recipes.map((recipe) => ({ slug: recipe.slug }));
		}
	} catch {
		// fall through
	}
	return [{ slug: "_" }];
}

const fetchLiquidRecipeMeta = cache(async (slug: string) => {
	const { ready } = await checkDbConnection();
	if (!ready) return null;

	const recipe = await withUserScope(async (scopedDb) => {
		return scopedDb
			.selectFrom("recipes")
			.select(["name", "description", "category", "version", "updated_at"])
			.where("slug", "=", slug)
			.where("type", "=", "liquid")
			.executeTakeFirst();
	});

	return recipe ?? null;
});

const LiquidRenderComponent = ({
	slug,
	format,
	title,
	imageWidth,
	imageHeight,
	customFieldOverrides,
}: {
	slug: string;
	format: "bitmap" | "png" | "react";
	title: string;
	imageWidth: number;
	imageHeight: number;
	customFieldOverrides?: Record<string, unknown>;
}) => {
	const result = use(renderLiquidRecipe(slug, customFieldOverrides));

	if (!result) {
		return (
			<EmptyRenderState>Failed to render liquid template</EmptyRenderState>
		);
	}

	if (format === "react") {
		return (
			<ScaledRenderPreview imageWidth={imageWidth} imageHeight={imageHeight}>
				<LiquidPreview
					html={result.html}
					width={imageWidth}
					height={imageHeight}
				/>
			</ScaledRenderPreview>
		);
	}

	const renders = use(
		renderRecipeOutputs({
			slug,
			html: result.html,
			config: null,
			imageWidth,
			imageHeight,
		}),
	);

	if (format === "bitmap" || format === "png") {
		return (
			<RenderOutputForFormat
				format={format}
				renders={renders}
				title={title}
				imageWidth={imageWidth}
				imageHeight={imageHeight}
			/>
		);
	}

	return null;
};

function MetaChips({
	type,
	version,
	category,
	updatedAt,
}: {
	type?: string | null;
	version?: string | number | null;
	category?: string | null;
	updatedAt?: string | null;
}) {
	return (
		<div className="flex flex-wrap items-center gap-1.5 text-xs">
			{type && (
				<Badge
					variant="outline"
					className="uppercase tracking-wider text-[10px]"
				>
					{type}
				</Badge>
			)}
			{version != null && version !== "" && (
				<Badge variant="secondary" className="tabular-nums">
					v{version}
				</Badge>
			)}
			{category && (
				<span className="rounded-md border bg-muted/40 px-2 py-0.5 capitalize text-muted-foreground">
					{String(category).replace(/-/g, " ")}
				</span>
			)}
			{updatedAt && (
				<span className="text-muted-foreground tabular-nums">
					Updated {new Date(updatedAt).toLocaleDateString()}
				</span>
			)}
		</div>
	);
}

function SectionCard({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<section className="space-y-3">
			<div className="flex items-center gap-3">
				<h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
					{label}
				</h3>
				<div className="h-px flex-1 bg-border" />
			</div>
			{children}
		</section>
	);
}

type RecipePageViewProps = {
	slug: string;
	isPortrait: boolean;
	imageWidth: number;
	imageHeight: number;
};

export default async function RecipePage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ format?: string }>;
}) {
	headers();
	const { slug } = await params;
	const { format } = await searchParams;
	const config = await fetchRecipeConfig(slug);
	const isPortrait = format === "portrait";
	const imageWidth = isPortrait ? DEFAULT_IMAGE_HEIGHT : DEFAULT_IMAGE_WIDTH;
	const imageHeight = isPortrait ? DEFAULT_IMAGE_WIDTH : DEFAULT_IMAGE_HEIGHT;

	if (!config) {
		return (
			<LiquidRecipePage
				slug={slug}
				isPortrait={isPortrait}
				imageWidth={imageWidth}
				imageHeight={imageHeight}
			/>
		);
	}

	return (
		<ReactRecipePage
			slug={slug}
			config={config}
			isPortrait={isPortrait}
			imageWidth={imageWidth}
			imageHeight={imageHeight}
		/>
	);
}

async function LiquidRecipePage({
	slug,
	isPortrait,
	imageWidth,
	imageHeight,
}: RecipePageViewProps) {
	const liquidMeta = await fetchLiquidRecipeMeta(slug);
	if (!liquidMeta) notFound();

	const title = liquidMeta.name;
	const description = liquidMeta.description;

	const liquidSettings = await fetchLiquidRecipeSettings(slug);
	const customFields = liquidSettings?.custom_fields ?? [];
	const paramDefinitions = customFieldsToParamDefinitions(customFields);
	const hasParams = Object.keys(paramDefinitions).length > 0;
	const storedValues = hasParams
		? await getScreenParams(slug, paramDefinitions)
		: {};

	return (
		<div className="@container">
			<PageTemplate
				title={
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
						<MetaChips
							type="liquid"
							version={liquidMeta.version}
							category={liquidMeta.category}
							updatedAt={
								liquidMeta.updated_at instanceof Date
									? liquidMeta.updated_at.toISOString()
									: liquidMeta.updated_at
							}
						/>
					</div>
				}
				subtitle={
					description ? (
						<p className="text-sm text-muted-foreground max-w-prose">
							{description}
						</p>
					) : null
				}
				left={<DeleteRecipeButton slug={slug} />}
			>
				<RecipePreviewStage
					slug={slug}
					isPortrait={isPortrait}
					reactNode={
						<Suspense
							fallback={<RenderLoadingState label="Rendering recipe…" />}
						>
							<LiquidRenderComponent
								slug={slug}
								format="react"
								title={title}
								imageWidth={imageWidth}
								imageHeight={imageHeight}
								customFieldOverrides={storedValues}
							/>
						</Suspense>
					}
					bmpPipeline={
						<span>
							Liquid → liquidjs → HTML → Puppeteer PNG → render-bmp →{" "}
							<Link href={`/api/bitmap/${slug}/default.bmp`}>
								/api/bitmap/{slug}/default.bmp
							</Link>
						</span>
					}
					pngPipeline={
						<span>
							Liquid → liquidjs → HTML → Puppeteer PNG →{" "}
							<Link href={`/api/png/${slug}/default.png`}>
								/api/png/{slug}/default.png
							</Link>
						</span>
					}
					reactPipeline={
						<span>Liquid → liquidjs → HTML → browser preview</span>
					}
					reactLabel="LIQUID"
				/>

				{hasParams && (
					<ScreenParamsForm
						slug={slug}
						paramsSchema={paramDefinitions}
						initialValues={storedValues}
						updateAction={updateScreenParams}
					/>
				)}
			</PageTemplate>
		</div>
	);
}

async function ReactRecipePage({
	slug,
	config,
	isPortrait,
}: RecipePageViewProps & { config: RecipeConfig }) {
	const screenParams = config.params
		? await getScreenParams(slug, config.params)
		: {};
	const rendererType = getRendererType();
	const renderPipeline =
		rendererType === "browser"
			? "JSX → browser PNG"
			: `JSX → pre-satori → ${rendererType} PNG`;

	return (
		<div className="@container">
			<PageTemplate
				title={
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<h1 className="text-2xl font-bold tracking-tight">
							{config.title}
						</h1>
						<MetaChips
							type="react"
							version={config.version as string | number | null | undefined}
							category={config.category as string | null | undefined}
						/>
					</div>
				}
				subtitle={
					<>
						{config.description && (
							<p className="text-sm text-muted-foreground max-w-prose">
								{config.description}
							</p>
						)}
						{config.renderSettings?.doubleSizeForSharperText && (
							<p className="mt-1 text-xs text-muted-foreground max-w-prose">
								Rendering at double size for sharper text — some layouts with
								overflow-hidden may need adjustment.
							</p>
						)}
					</>
				}
				left={<DeleteRecipeButton slug={slug} />}
			>
				<RecipePreviewStage
					slug={slug}
					isPortrait={isPortrait}
					reactPreviewSrc={`/preview/recipe/${slug}`}
					bmpPipeline={
						<span>
							{renderPipeline} → render-bmp →{" "}
							<Link href={`/api/bitmap/${slug}/default.bmp`}>
								/api/bitmap/{slug}/default.bmp
							</Link>
						</span>
					}
					pngPipeline={
						<span>
							{renderPipeline} →{" "}
							<Link href={`/api/png/${slug}/default.png`}>
								/api/png/{slug}/default.png
							</Link>
						</span>
					}
					reactPipeline={
						<span>
							/recipes/screens/{slug}/{slug}.tsx
						</span>
					}
				/>

				{config.params && Object.keys(config.params).length > 0 && (
					<ScreenParamsForm
						slug={slug}
						paramsSchema={config.params}
						initialValues={screenParams}
						updateAction={updateScreenParams}
					/>
				)}

				{config.hasDataFetch && (
					<SectionCard label="Data">
						<Suspense
							fallback={
								<div className="text-sm text-muted-foreground">
									Loading props…
								</div>
							}
						>
							<PropsDisplay slug={slug} config={config} />
						</Suspense>
					</SectionCard>
				)}
			</PageTemplate>
		</div>
	);
}

const PropsDisplay = ({
	slug,
	config,
}: {
	slug: string;
	config: RecipeConfig;
}) => {
	const propsResult = use(Promise.resolve(fetchRecipeProps(slug, config)));
	return (
		<RecipeProps props={propsResult} slug={slug} refreshAction={refreshData} />
	);
};
