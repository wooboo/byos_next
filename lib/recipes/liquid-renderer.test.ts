import { Liquid } from "liquidjs";
import { afterEach, describe, expect, it, vi } from "vitest";

type RecipeFileRow = { filename: string; content: string };

async function loadModule(options?: {
	dbReady?: boolean;
	recipeFiles?: RecipeFileRow[];
	recipeRow?: { id: string } | undefined;
}) {
	vi.resetModules();

	const state = {
		dbReady: options?.dbReady ?? true,
		recipeFiles: options?.recipeFiles ?? [],
		recipeRow: options?.recipeRow,
	};

	const mockDb = {
		selectFrom: vi.fn((table: string) => {
			const builder = {
				innerJoin: vi.fn(() => builder),
				select: vi.fn(() => builder),
				where: vi.fn(() => builder),
				execute: vi.fn(async () =>
					table === "recipe_files" ? state.recipeFiles : [],
				),
				executeTakeFirst: vi.fn(async () =>
					table === "recipes" ? state.recipeRow : undefined,
				),
			};
			return builder;
		}),
	};

	const checkDbConnectionMock = vi.fn(async () => ({ ready: state.dbReady }));
	const withExplicitUserScopeMock = vi.fn(async (_userId, runQuery) =>
		runQuery(mockDb),
	);
	const logger = {
		warn: vi.fn(),
		error: vi.fn(),
	};

	vi.doMock("@/lib/database/db", () => ({ db: mockDb }));
	vi.doMock("@/lib/database/scoped-db", () => ({
		withExplicitUserScope: withExplicitUserScopeMock,
	}));
	vi.doMock("@/lib/database/utils", () => ({
		checkDbConnection: checkDbConnectionMock,
	}));
	vi.doMock("@/lib/recipes/logger", () => ({ logger }));

	const mod = await import("./liquid-renderer");
	return {
		...mod,
		mockDb,
		checkDbConnectionMock,
		withExplicitUserScopeMock,
		logger,
	};
}

describe("liquid-renderer helpers", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.doUnmock("@/lib/database/db");
		vi.doUnmock("@/lib/database/scoped-db");
		vi.doUnmock("@/lib/database/utils");
		vi.doUnmock("@/lib/recipes/logger");
	});

	it("wraps only inline non-liquid scripts in raw tags", async () => {
		const { wrapNonLiquidScripts } = await loadModule();

		const result = wrapNonLiquidScripts(`
<script>const x = {...window.state};</script>
<script>const greeting = "{{ name }}";</script>
<script src="/static/app.js"></script>
`);

		expect(result).toContain(
			"<script>{% raw %}const x = {...window.state};{% endraw %}</script>",
		);
		expect(result).toContain('<script>const greeting = "{{ name }}";</script>');
		expect(result).toContain('<script src="/static/app.js"></script>');
	});

	it("removes cosmetic parentheses from liquid conditionals", async () => {
		const { removeCosmeticParens } = await loadModule();

		const result = removeCosmeticParens(
			"{% if (enabled) and (count > 0) %}ok{% elsif (other) %}fallback{% endif %}",
		);

		expect(result).toBe(
			"{% if enabled and count > 0 %}ok{% elsif other %}fallback{% endif %}",
		);
	});

	it("registers custom TRMNL-compatible filters on a Liquid engine", async () => {
		const { registerCustomFilters } = await loadModule();
		const engine = new Liquid();
		registerCustomFilters(engine);

		const rendered = await engine.parseAndRender(
			[
				"{{ items | find_by: 'slug', 'b' | json }}",
				"{{ items | group_by: 'group' | json }}",
				"{{ count | pluralize: 'item', 'items' }}",
				"{{ date | l_date: '%m/%d/%Y' }}",
			].join("\n"),
			{
				items: [
					{ slug: "a", group: "first" },
					{ slug: "b", group: "second" },
				],
				count: 2,
				date: "2026-02-03T12:00:00Z",
			},
		);

		expect(rendered).toContain('{"slug":"b","group":"second"}');
		expect(rendered).toContain('"first":[{"slug":"a","group":"first"}]');
		expect(rendered).toContain("items");
		expect(rendered).toContain("02/03/2026");
	});
});

describe("fetchLiquidRecipeSettings", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.doUnmock("@/lib/database/db");
		vi.doUnmock("@/lib/database/scoped-db");
		vi.doUnmock("@/lib/database/utils");
		vi.doUnmock("@/lib/recipes/logger");
	});

	it("loads and parses settings.yml after stripping a GitHub archive prefix", async () => {
		const { fetchLiquidRecipeSettings } = await loadModule({
			recipeFiles: [
				{
					filename: "recipe-main/settings.yml",
					content:
						"polling_url: https://api.example/data\ncustom_fields:\n  - keyname: city\n    default: Warsaw\n",
				},
				{
					filename: "recipe-main/src/full.liquid",
					content: "<p>Hello</p>",
				},
			],
		});

		const settings = await fetchLiquidRecipeSettings("weather");

		expect(settings).toEqual({
			polling_url: "https://api.example/data",
			custom_fields: [{ keyname: "city", default: "Warsaw" }],
		});
	});
});

describe("renderLiquidRecipe", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.doUnmock("@/lib/database/db");
		vi.doUnmock("@/lib/database/scoped-db");
		vi.doUnmock("@/lib/database/utils");
		vi.doUnmock("@/lib/recipes/logger");
	});

	it("renders a liquid recipe with shared partials, custom field overrides, and safe polling data", async () => {
		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(
				new Response(JSON.stringify({ temp: 21 }), { status: 200 }),
			);
		const { renderLiquidRecipe } = await loadModule({
			recipeFiles: [
				{
					filename: "recipe-main/settings.yml",
					content: [
						"polling_url: |",
						"  https://api.example/{{ city }}",
						"  http://127.0.0.1/private",
						"custom_fields:",
						"  - keyname: city",
						"    default: Paris",
					].join("\n"),
				},
				{
					filename: "recipe-main/src/shared.liquid",
					content:
						"{% template greeting %}<h1>{{ trmnl.plugin_settings.custom_fields_values.city }}</h1>{% endtemplate %}",
				},
				{
					filename: "recipe-main/src/full.liquid",
					content:
						"{% render 'greeting' %}<p>{{ IDX_0.temp }}</p><script>const x = {...window.state};</script>",
				},
			],
		});

		const result = await renderLiquidRecipe("weather", { city: "Warsaw" });

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy).toHaveBeenCalledWith("https://api.example/Warsaw", {
			signal: expect.any(AbortSignal),
			headers: { "User-Agent": "BYOS/1.0" },
			redirect: "error",
		});
		expect(result?.settings.custom_fields?.[0]?.default).toBe("Paris");
		expect(result?.html).toContain("<h1>Warsaw</h1>");
		expect(result?.html).toContain("<p>21</p>");
		expect(result?.html).toContain(
			"<script>const x = {...window.state};</script>",
		);
		expect(result?.html).toContain(
			'<link rel="stylesheet" href="https://trmnl.com/css/latest/plugins.css">',
		);
	});

	it("returns null when no main template exists", async () => {
		const { renderLiquidRecipe, logger } = await loadModule({
			recipeFiles: [
				{
					filename: "recipe-main/settings.yml",
					content: "custom_fields: []",
				},
			],
		});

		const result = await renderLiquidRecipe("broken");

		expect(result).toBeNull();
		expect(logger.error).toHaveBeenCalledWith(
			"No full.liquid template found for recipe: broken",
		);
	});
});

describe("customFieldsToParamDefinitions and isLiquidRecipe", () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.doUnmock("@/lib/database/db");
		vi.doUnmock("@/lib/database/scoped-db");
		vi.doUnmock("@/lib/database/utils");
		vi.doUnmock("@/lib/recipes/logger");
	});

	it("maps TRMNL custom fields into recipe param definitions", async () => {
		const { customFieldsToParamDefinitions } = await loadModule();

		expect(
			customFieldsToParamDefinitions([
				{
					keyname: "city",
					name: "City",
					default: "Warsaw",
					description: "Shown in the header",
				},
				{
					keyname: "count",
					field_type: "number",
					default: 3,
				},
				{
					name: "ignored",
				},
			]),
		).toEqual({
			city: {
				label: "City",
				type: "string",
				default: "Warsaw",
				description: "Shown in the header",
			},
			count: {
				label: "count",
				type: "number",
				default: 3,
				description: undefined,
			},
		});
	});

	it("checks whether a liquid recipe exists only when the database is ready", async () => {
		const readyModule = await loadModule({
			recipeRow: { id: "recipe-1" },
		});
		const notReadyModule = await loadModule({
			dbReady: false,
		});

		expect(await readyModule.isLiquidRecipe("weather")).toBe(true);
		expect(await notReadyModule.isLiquidRecipe("weather")).toBe(false);
	});
});
