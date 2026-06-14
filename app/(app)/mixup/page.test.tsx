import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import type { Mixup, Recipe } from "@/lib/types";

type MixupScreen = { id: string; name: string; recipe_name: string };
type CapturedClientProps = {
	initialMixups: Mixup[];
	recipes: Array<{
		id: string;
		slug: string;
		title: string;
		description?: string;
	}>;
	screens: Array<{ id: string; title: string; description?: string }>;
};

const mixupState = vi.hoisted(() => ({
	mixups: [] as Mixup[],
	recipes: [] as Recipe[],
	screens: [] as MixupScreen[],
	capturedClientProps: null as CapturedClientProps | null,
}));

vi.mock("@/app/actions/mixup", () => ({
	fetchMixups: vi.fn(async () => mixupState.mixups),
	fetchRecipes: vi.fn(async () => mixupState.recipes),
}));

vi.mock("@/app/actions/screens", () => ({
	listScreens: vi.fn(async () => mixupState.screens),
}));

vi.mock("./client-page", () => ({
	default: (props: CapturedClientProps) => {
		mixupState.capturedClientProps = props;
		return <div>mixup-client:{JSON.stringify(props)}</div>;
	},
}));

type MixupPageModule = typeof import("./page.tsx").default;
let pageCache: MixupPageModule | null = null;

async function getPage() {
	if (!pageCache) {
		pageCache = (await import("./page.tsx")).default;
	}
	return pageCache;
}

describe("Mixup page", () => {
	it("passes empty data to client page", async () => {
		mixupState.mixups = [];
		mixupState.recipes = [];
		mixupState.screens = [];
		mixupState.capturedClientProps = null;

		const MixupPage = await getPage();
		const html = renderToStaticMarkup(await MixupPage());

		assert.match(html, /mixup-client:/);
		assert.deepEqual(mixupState.capturedClientProps, {
			initialMixups: [],
			recipes: [],
			screens: [],
		});
	});

	it("maps recipes and screens for client page", async () => {
		mixupState.mixups = [
			{
				id: "mixup-1",
				name: "Split",
				layout_id: "quarters",
				created_at: null,
				updated_at: null,
			},
		];
		mixupState.recipes = [
			{
				id: "recipe-1",
				slug: "weather",
				name: "Weather",
				description: "Current weather",
				type: "liquid",
				repo: null,
				screenshot_url: null,
				logo_url: null,
				author: null,
				author_github: null,
				author_email: null,
				zip_url: null,
				zip_entry_path: null,
				category: null,
				version: null,
				user_id: null,
				created_at: null,
				updated_at: null,
			},
		];
		mixupState.screens = [
			{
				id: "screen-1",
				name: "Living room",
				recipe_name: "Weather",
			},
		];
		mixupState.capturedClientProps = null;

		const MixupPage = await getPage();
		const html = renderToStaticMarkup(await MixupPage());

		assert.match(html, /split/i);
		assert.deepEqual(mixupState.capturedClientProps, {
			initialMixups: mixupState.mixups,
			recipes: [
				{
					id: "recipe-1",
					slug: "weather",
					title: "Weather",
					description: "Current weather",
				},
			],
			screens: [
				{
					id: "screen-1",
					title: "Living room",
					description: "Weather",
				},
			],
		});
	});
});
