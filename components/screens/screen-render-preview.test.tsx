import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import { ScreenRenderPreview } from "./screen-render-preview";

vi.mock("@/components/recipes/recipe-preview-stage", () => ({
	RecipePreviewStage: ({
		slug,
		basePath,
		bitmapUrl,
		pngUrl,
		isPortrait,
		reactPreviewSrc,
		bmpPipeline,
		pngPipeline,
		reactPipeline,
	}: {
		slug: string;
		basePath: string;
		bitmapUrl: string;
		pngUrl: string;
		isPortrait: boolean;
		reactPreviewSrc: string;
		bmpPipeline: React.ReactNode;
		pngPipeline: React.ReactNode;
		reactPipeline: React.ReactNode;
	}) => (
		<div
			data-slug={slug}
			data-base-path={basePath}
			data-bitmap-url={bitmapUrl}
			data-png-url={pngUrl}
			data-is-portrait={String(isPortrait)}
			data-react-preview-src={reactPreviewSrc}
		>
			<div>{bmpPipeline}</div>
			<div>{pngPipeline}</div>
			<div>{reactPipeline}</div>
		</div>
	),
}));

vi.mock("next/link", () => ({
	default: ({
		href,
		children,
	}: {
		href: string;
		children: React.ReactNode;
	}) => <a href={href}>{children}</a>,
}));

describe("ScreenRenderPreview", () => {
	it("wires screen-specific endpoint URLs into the shared preview stage", () => {
		const html = renderToStaticMarkup(
			<ScreenRenderPreview
				screenId="screen-1"
				recipeSlug="weather"
				title="Lobby weather"
				isPortrait
				imageWidth={480}
				imageHeight={800}
				paramsOverride={{ city: "Warsaw" }}
				userId="user-1"
			/>,
		);

		assert.match(html, /data-slug="weather"/);
		assert.match(html, /data-base-path="\/screens\/screen-1"/);
		assert.match(
			html,
			/data-bitmap-url="\/api\/bitmap\/weather\/screen-1\.bmp"/,
		);
		assert.match(html, /data-png-url="\/api\/png\/weather\/screen-1\.png"/);
		assert.match(html, /data-is-portrait="true"/);
		assert.match(html, /data-react-preview-src="\/preview\/screen\/screen-1"/);
		assert.match(html, /<a href="\/api\/bitmap\/weather\/screen-1\.bmp">/);
		assert.match(html, /<a href="\/api\/png\/weather\/screen-1\.png">/);
		assert.match(html, /JSX → screen params → browser PNG/);
		assert.match(html, /JSX → screen params → React preview/);
	});
});
