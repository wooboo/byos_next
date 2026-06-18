import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

type CapturedScreenPreviewProps = {
	screenId: string;
	recipeSlug: string;
	title: string;
	isPortrait: boolean;
	imageWidth: number;
	imageHeight: number;
	paramsOverride: Record<string, unknown>;
	userId: string | undefined | null;
};

type CapturedNameFormProps = { id: string; initialName: string };

type CapturedParamsFormProps = {
	slug: string;
	paramsSchema: Record<string, unknown>;
	initialValues: Record<string, unknown>;
};

type ScreenPageQuery = {
	id: string;
	name: string;
	params: string | Record<string, unknown> | null;
	recipe_name: string;
	recipe_slug: string;
};

const screenState = vi.hoisted(() => ({
	currentUserId: "user-1" as string | null,
	screenQueryResult: null as ScreenPageQuery | null,
	recipeConfigResult: null as {
		title: string;
		params?: Record<string, unknown>;
	} | null,
	notFoundCallCount: 0,
	screenPreviewProps: null as CapturedScreenPreviewProps | null,
	nameFormProps: null as CapturedNameFormProps | null,
	paramsFormProps: null as CapturedParamsFormProps | null,
}));

vi.mock("next/navigation", () => ({
	notFound: () => {
		screenState.notFoundCallCount += 1;
		throw new Error("NOT_FOUND");
	},
}));

vi.mock("@/app/actions/screens", () => ({
	deleteScreen: vi.fn(async () => ({ success: true })),
	updateNamedScreenParams: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/auth/get-user", () => ({
	getCurrentUserId: vi.fn(async () => screenState.currentUserId),
}));

vi.mock("@/lib/database/scoped-db", () => ({
	withUserScope: vi.fn(async (callback: (db: unknown) => unknown) => {
		const queryBuilder = {
			innerJoin: vi.fn(() => queryBuilder),
			select: vi.fn(() => queryBuilder),
			selectAll: vi.fn(() => queryBuilder),
			where: vi.fn(() => queryBuilder),
			executeTakeFirst: vi.fn(async () => screenState.screenQueryResult),
		};

		return callback({ selectFrom: () => queryBuilder } as unknown);
	}),
}));

vi.mock("@/lib/recipes/recipe-renderer", () => ({
	fetchRecipeConfig: vi.fn(async () => screenState.recipeConfigResult),
	DEFAULT_IMAGE_WIDTH: 800,
	DEFAULT_IMAGE_HEIGHT: 480,
}));

vi.mock("@/components/common/page-template", () => ({
	PageTemplate: ({
		title,
		subtitle,
		left,
		children,
	}: {
		title: string;
		subtitle: string;
		left?: React.ReactNode;
		children: React.ReactNode;
	}) => {
		return (
			<div data-title={title} data-subtitle={subtitle}>
				{left}
				{children}
			</div>
		);
	},
}));

vi.mock("@/components/screens/delete-screen-button", () => ({
	DeleteScreenButton: ({ id, name }: { id: string; name: string }) => (
		<div>
			delete-screen:{id}:{name}
		</div>
	),
}));

vi.mock("@/components/screens/clone-screen-button", () => ({
	CloneScreenButton: ({ id }: { id: string }) => <div>clone-screen:{id}</div>,
}));

vi.mock("@/components/screens/screen-render-preview", () => ({
	ScreenRenderPreview: (props: {
		screenId: string;
		recipeSlug: string;
		title: string;
		isPortrait: boolean;
		imageWidth: number;
		imageHeight: number;
		paramsOverride: Record<string, unknown>;
		userId: string | null | undefined;
	}) => {
		screenState.screenPreviewProps = props;
		return <div>screen-render-preview</div>;
	},
}));

vi.mock("@/components/screens/screen-name-form", () => ({
	ScreenNameForm: (props: { id: string; initialName: string }) => {
		screenState.nameFormProps = props;
		return <div>screen-name-form</div>;
	},
}));

vi.mock("@/components/recipes/screen-params-form", () => ({
	ScreenParamsForm: (props: {
		slug: string;
		paramsSchema: Record<string, unknown>;
		initialValues: Record<string, unknown>;
	}) => {
		screenState.paramsFormProps = props;
		return <div>screen-params-form</div>;
	},
}));

type DetailPageModule = typeof import("./page.tsx");
let pageCache: DetailPageModule | null = null;

async function getPage() {
	if (!pageCache) {
		pageCache = await import("./page.tsx");
	}
	return pageCache.default;
}

describe("Screen detail page", () => {
	it("renders not found for missing screen", async () => {
		screenState.screenQueryResult = null;
		screenState.currentUserId = "user-1";
		screenState.notFoundCallCount = 0;

		const ScreenDetailPage = await getPage();
		await assert.rejects(async () => {
			await ScreenDetailPage({
				params: Promise.resolve({ id: "screen-404" }),
				searchParams: Promise.resolve({}),
			});
		}, /NOT_FOUND/);
		assert.equal(screenState.notFoundCallCount, 1);
	});

	it("preloads render data from parsed JSON params and calculates portrait sizing", async () => {
		screenState.screenQueryResult = {
			id: "screen-1",
			name: "Lobby",
			recipe_slug: "calendar",
			recipe_name: "Calendar",
			params: '{"theme":"dark"}',
		};
		screenState.recipeConfigResult = { title: "Calendar", params: {} };
		screenState.currentUserId = "user-1";
		screenState.screenPreviewProps = null;
		screenState.nameFormProps = null;
		screenState.paramsFormProps = null;

		const ScreenDetailPage = await getPage();
		const html = renderToStaticMarkup(
			await ScreenDetailPage({
				params: Promise.resolve({ id: "screen-1" }),
				searchParams: Promise.resolve({ format: "portrait" }),
			}),
		);
		const previewProps =
			screenState.screenPreviewProps as CapturedScreenPreviewProps | null;
		const formProps = screenState.nameFormProps as CapturedNameFormProps | null;
		const paramsProps =
			screenState.paramsFormProps as CapturedParamsFormProps | null;

		assert.ok(previewProps);
		assert.ok(formProps);
		assert.ok(paramsProps);
		assert.equal(previewProps.screenId, "screen-1");
		assert.equal(previewProps.isPortrait, true);
		assert.equal(previewProps.imageWidth, 480);
		assert.equal(previewProps.imageHeight, 800);
		assert.deepEqual(previewProps.paramsOverride, { theme: "dark" });
		assert.equal(formProps.id, "screen-1");
		assert.equal(formProps.initialName, "Lobby");
		assert.equal(paramsProps.slug, "screen-1");
		assert.deepEqual(paramsProps.initialValues, { theme: "dark" });
		assert.match(html, /screen-render-preview/);
		assert.match(html, /screen-name-form/);
		assert.match(html, /href="\/screens"/);
		assert.match(html, /Back to list/);
		assert.match(html, /clone-screen:screen-1/);
		assert.match(html, /delete-screen:screen-1:Lobby/);
	});

	it("falls back to empty schema and object params in landscape", async () => {
		screenState.screenQueryResult = {
			id: "screen-2",
			name: "Kitchen",
			recipe_slug: "weather",
			recipe_name: "Weather",
			params: { location: "Warsaw" },
		};
		screenState.recipeConfigResult = null;
		screenState.screenPreviewProps = null;
		screenState.paramsFormProps = null;
		screenState.nameFormProps = null;

		const ScreenDetailPage = await getPage();
		await renderToStaticMarkup(
			await ScreenDetailPage({
				params: Promise.resolve({ id: "screen-2" }),
				searchParams: Promise.resolve({}),
			}),
		);
		const previewProps =
			screenState.screenPreviewProps as CapturedScreenPreviewProps | null;
		const paramsProps =
			screenState.paramsFormProps as CapturedParamsFormProps | null;

		assert.ok(previewProps);
		assert.ok(paramsProps);
		assert.equal(previewProps.isPortrait, false);
		assert.equal(previewProps.imageWidth, 800);
		assert.equal(previewProps.imageHeight, 480);
		assert.deepEqual(paramsProps.paramsSchema, {});
		assert.equal(previewProps.userId, "user-1");
	});
});
