import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import type { CatalogEntry, TrmnlRecipe } from "@/lib/catalog";

type CapturedCatalogProps = {
	communityEntries: CatalogEntry[];
	communityError: string | null;
	officialEntries: TrmnlRecipe[];
	officialError: string | null;
};

const catalogState = vi.hoisted(() => ({
	isCatalogEnabled: true,
	catalogResult: {
		entries: [] as CatalogEntry[],
		error: null as string | null,
	},
	trmnlResult: {
		recipes: [] as TrmnlRecipe[],
		error: null as string | null,
		nextPage: null as number | null,
		total: null as number | null,
	},
	latestCatalogProps: null as CapturedCatalogProps | null,
}));

vi.mock("@/lib/catalog", () => ({
	fetchCatalogResult: vi.fn(async () => catalogState.catalogResult),
	fetchTrmnlRecipesPage: vi.fn(async () => ({
		recipes: catalogState.trmnlResult.recipes,
		currentPage: 1,
		nextPage: catalogState.trmnlResult.nextPage,
		total: catalogState.trmnlResult.total,
		error: catalogState.trmnlResult.error,
	})),
	isExternalCatalogEnabled: () => catalogState.isCatalogEnabled,
}));

vi.mock("./catalog-grid", () => ({
	CatalogPage: (props: CapturedCatalogProps) => {
		catalogState.latestCatalogProps = props;
		return <pre>{JSON.stringify(props)}</pre>;
	},
}));

type CatalogPageModule = typeof import("./page.tsx");
let moduleCache: CatalogPageModule | null = null;

async function getCatalogPage() {
	if (!moduleCache) {
		moduleCache = await import("./page.tsx");
	}
	return moduleCache.default;
}

describe("Catalog page", () => {
	it("passes catalog action errors through to catalog grid when disabled", async () => {
		catalogState.catalogResult = {
			entries: [],
			error: "External catalog is disabled.",
		};
		catalogState.trmnlResult = {
			recipes: [],
			error: "External catalog is disabled.",
			nextPage: null,
			total: null,
		};
		catalogState.isCatalogEnabled = false;
		catalogState.latestCatalogProps = null;

		const CatalogPage = await getCatalogPage();
		const html = renderToStaticMarkup(await CatalogPage());
		const props =
			catalogState.latestCatalogProps as CapturedCatalogProps | null;

		assert.ok(props);
		assert.equal(props.communityError, "External catalog is disabled.");
		assert.equal(props.officialError, "External catalog is disabled.");
		assert.match(html, /External catalog is disabled/);
	});

	it("passes populated payloads through", async () => {
		catalogState.catalogResult = {
			entries: [
				{
					name: "Community A",
					trmnlp: {
						id: 7,
						repo: "https://example.com/repo",
						zip_url: null,
						zip_entry_path: null,
						version: "1",
					},
					logo_url: null,
					screenshot_url: null,
					license: "MIT",
					byos: {},
					author: { github: "dev" },
					funding: {},
					author_bio: { description: "desc" },
				},
			],
			error: null,
		};
		catalogState.trmnlResult = {
			recipes: [
				{
					id: 12,
					name: "Official A",
					published_at: new Date().toISOString(),
					icon_url: null,
					screenshot_url: null,
					author_bio: { name: "Team A" },
					stats: { installs: 5, forks: 1 },
				},
			],
			error: null,
			nextPage: 2,
			total: 12,
		};
		catalogState.isCatalogEnabled = true;
		catalogState.latestCatalogProps = null;

		const CatalogPage = await getCatalogPage();
		const html = renderToStaticMarkup(await CatalogPage());
		const props =
			catalogState.latestCatalogProps as CapturedCatalogProps | null;

		assert.ok(props);
		assert.equal(props.communityEntries.length, 1);
		assert.equal(props.officialEntries.length, 1);
		assert.match(html, /Community A/);
		assert.match(html, /Official A/);
	});
});
