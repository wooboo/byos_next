import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("./globals.css", () => ({
	default: "",
}));

vi.mock("@/components/theme-provider", () => ({
	ThemeProvider: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/tooltip", () => ({
	TooltipProvider: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/sonner", () => ({
	Toaster: () => <div>Toaster</div>,
}));

vi.mock("@/lib/fonts", () => ({
	getAllFontVariables: () => "font-a font-b",
}));

vi.mock("@/lib/utils", () => ({
	cn: (...items: Array<string | false | null | undefined>) =>
		items.filter(Boolean).join(" "),
}));

type RootLayoutComponent = typeof import("./layout.tsx").default;
let rootLayout: RootLayoutComponent | undefined;

async function getRootLayout() {
	rootLayout ??= (await import("./layout.tsx")).default;
	return rootLayout;
}

describe("app root layout", () => {
	it("renders base HTML shell with body class and toaster", async () => {
		const RootLayout = await getRootLayout();
		const html = renderToStaticMarkup(
			<RootLayout>
				<main>Shell</main>
			</RootLayout>,
		);

		assert.match(html, /<html/);
		assert.match(html, /lang="en"/);
		assert.match(
			html,
			/bg-background overscroll-none font-sans antialiased font-a font-b/,
		);
		assert.match(html, /Shell/);
		assert.match(html, /Toaster/);
	});
});
