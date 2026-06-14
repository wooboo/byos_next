import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, it, vi } from "vitest";

vi.mock("next/link", () => ({
	default: ({
		href,
		children,
	}: {
		href: string;
		children: React.ReactNode;
	}) => <a href={href}>{children}</a>,
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

vi.mock("@/components/ui/badge", () => ({
	Badge: ({ children }: { children: React.ReactNode }) => (
		<span>{children}</span>
	),
}));

type ToolsPageModule = typeof import("./page.tsx");
let moduleCache: ToolsPageModule | null = null;

async function getPage() {
	if (!moduleCache) {
		moduleCache = await import("./page.tsx");
	}
	return moduleCache.default;
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("Tools page", () => {
	it("renders all tools outside production", async () => {
		vi.stubEnv("NODE_ENV", "test");

		const ToolsPage = await getPage();
		const html = renderToStaticMarkup(<ToolsPage />);

		assert.match(html, /Tools/);
		assert.match(html, /1-Bit Image Ditherer/);
		assert.match(html, /Bitmap Font Designer/);
		assert.match(html, /image tools/);
		assert.match(html, /font tools/);
	});

	it("keeps only published tools in production", async () => {
		vi.stubEnv("NODE_ENV", "production");

		const ToolsPage = await getPage();
		const html = renderToStaticMarkup(<ToolsPage />);

		assert.match(html, /1-Bit Image Ditherer/);
		assert.match(html, /Bitmap Font Designer/);
	});
});
