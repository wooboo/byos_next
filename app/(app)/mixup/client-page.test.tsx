import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	useRouter: vi.fn(() => ({
		refresh: vi.fn(),
	})),
}));

vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("@/components/mixup/mixup-builder", () => ({
	MixupBuilder: ({
		initialData,
	}: {
		initialData?: { id?: string; name?: string };
	}) => <div>mixup-builder:{initialData?.id ? "edit" : "new"}</div>,
}));

vi.mock("@/components/mixup/mixup-list", () => ({
	MixupList: ({ mixups }: { mixups: Array<{ id: string; name: string }> }) => (
		<div>mixup-list:{mixups.length}</div>
	),
}));

vi.mock("@/components/common/page-template", () => ({
	PageTemplate: ({ children }: { children?: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

type MixupClientPageModule = typeof import("./client-page.tsx");
let moduleCache: MixupClientPageModule | null = null;

async function getClientPage() {
	if (!moduleCache) {
		moduleCache = await import("./client-page.tsx");
	}
	return moduleCache.default;
}

describe("Mixup client page", () => {
	it("renders empty mixup list state", async () => {
		const MixupClientPage = await getClientPage();
		const html = renderToStaticMarkup(
			<MixupClientPage initialMixups={[]} recipes={[]} screens={[]} />,
		);

		assert.match(html, /mixup-list:0/);
	});

	it("renders mixup list with provided entries", async () => {
		const MixupClientPage = await getClientPage();

		const html = renderToStaticMarkup(
			<MixupClientPage
				initialMixups={[
					{
						id: "mixup-1",
						name: "Split screen",
						layout_id: "quarters",
						created_at: null,
						updated_at: null,
					},
				]}
				recipes={[
					{
						id: "recipe-1",
						slug: "a",
						title: "Recipe A",
						description: undefined,
					},
				]}
				screens={[
					{
						id: "screen-1",
						title: "Screen one",
						description: "",
					},
				]}
			/>,
		);

		assert.match(html, /mixup-list:1/);
	});
});
