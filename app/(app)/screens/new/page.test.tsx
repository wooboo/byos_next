import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

type CapturedCreateProps = {
	recipes: { id: string; name: string; slug: string }[];
};

const screenNewState = vi.hoisted(() => ({
	recipesResult: [] as Array<{ id: string; name: string; slug: string }>,
	capturedCreateProps: null as CapturedCreateProps | null,
}));

vi.mock("@/app/actions/mixup", () => ({
	fetchRecipes: vi.fn(async () => screenNewState.recipesResult),
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

vi.mock("@/components/screens/create-screen-form", () => ({
	CreateScreenForm: (props: {
		recipes: { id: string; name: string; slug: string }[];
	}) => {
		screenNewState.capturedCreateProps = props;
		return (
			<div>
				{props.recipes.map((recipe) => (
					<div key={recipe.id} data-recipe={recipe.id}>
						{recipe.name}
					</div>
				))}
			</div>
		);
	},
}));

type NewScreenPageModule = typeof import("./page.tsx");
let pageCache: NewScreenPageModule | null = null;

async function getPage() {
	if (!pageCache) {
		pageCache = await import("./page.tsx");
	}
	return pageCache.default;
}

describe("New screen page", () => {
	it("passes empty recipes to create form", async () => {
		screenNewState.recipesResult = [];
		screenNewState.capturedCreateProps = null;

		const NewScreenPage = await getPage();
		const html = renderToStaticMarkup(await NewScreenPage());
		const props =
			screenNewState.capturedCreateProps as CapturedCreateProps | null;

		assert.ok(props);
		assert.equal(props.recipes.length, 0);
		assert.match(html, /New screen/);
		assert.deepEqual(props.recipes, []);
	});

	it("passes transformed recipes to create form", async () => {
		screenNewState.recipesResult = [
			{
				id: "recipe-1",
				name: "Weather",
				slug: "weather",
			},
		];
		screenNewState.capturedCreateProps = null;

		const NewScreenPage = await getPage();
		const html = renderToStaticMarkup(await NewScreenPage());
		const props =
			screenNewState.capturedCreateProps as CapturedCreateProps | null;

		assert.ok(props);
		assert.equal(props.recipes.length, 1);
		assert.deepEqual(props.recipes[0], {
			id: "recipe-1",
			name: "Weather",
			slug: "weather",
		});
		assert.match(html, /Weather/);
	});
});
