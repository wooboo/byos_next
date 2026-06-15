import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import { RecipePreviewStage } from "./recipe-preview-stage";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: () => undefined }),
}));

vi.mock("@/components/common/device-frame", () => ({
	DeviceFrame: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/preview/scaled-react-preview", () => ({
	ScaledReactPreview: ({
		src,
		mode,
		width,
		height,
	}: {
		src: string;
		mode: string;
		width: number;
		height: number;
	}) => (
		<div data-react-preview={`${mode}:${width}x${height}:${src}`}>
			react-preview
		</div>
	),
}));

vi.mock("@/components/recipes/bmp-preview", () => ({
	BmpPreview: ({
		slug,
		width,
		height,
		bpp,
	}: {
		slug: string;
		width: number;
		height: number;
		bpp: number;
	}) => (
		<div data-bmp-preview={`${slug}:${width}x${height}:${bpp}`}>
			bmp-preview
		</div>
	),
	ImageEndpointPreview: ({
		requestUrl,
		width,
		height,
		alt,
	}: {
		requestUrl: string;
		width: number;
		height: number;
		alt: string;
	}) => (
		<div data-image-endpoint={`${alt}:${width}x${height}:${requestUrl}`}>
			image-endpoint-preview
		</div>
	),
}));

vi.mock("@/components/preview/screen-preview-controls", () => ({
	SCREEN_PREVIEW_PALETTES: [
		{ label: "BW", grayscale: 2 },
		{ label: "4 gray", grayscale: 4 },
		{ label: "16 gray", grayscale: 16 },
	],
	SCREEN_PREVIEW_SIZE_PRESETS: [{ label: "800×480", width: 800, height: 480 }],
	ScreenPreviewControls: ({
		format,
		className,
		reactLabel,
	}: {
		format: string;
		className?: string;
		reactLabel?: string;
	}) => (
		<div
			data-format={format}
			data-class-name={className ?? ""}
			data-react-label={reactLabel ?? ""}
		>
			controls
		</div>
	),
	screenPreviewSummary: ({
		format,
		width,
		height,
		reactMode,
		grayscale,
	}: {
		format: string;
		width: number;
		height: number;
		reactMode?: string;
		grayscale: number;
	}) => `${format}:${width}x${height}:${grayscale}:${reactMode ?? "none"}`,
}));

describe("RecipePreviewStage", () => {
	it("resolves the react preview URL with portrait dimensions", () => {
		const html = renderToStaticMarkup(
			<RecipePreviewStage
				slug="weather"
				isPortrait
				reactPreviewSrc="/preview/recipe/weather"
				defaultFormat="react"
				reactPipeline={<span>React pipeline</span>}
			/>,
		);

		assert.match(html, /data-format="react"/);
		assert.match(
			html,
			/data-react-preview="fit:480x800:\/preview\/recipe\/weather\?width=480&amp;height=800"/,
		);
		assert.match(html, /react:480x800:16:fit/);
		assert.match(html, /React pipeline/);
	});

	it("renders the default BMP preview pipeline when no custom nodes are provided", () => {
		const html = renderToStaticMarkup(
			<RecipePreviewStage
				slug="calendar"
				isPortrait={false}
				bitmapUrl="/api/bitmap/calendar.bmp"
				bmpPipeline={<span>BMP pipeline</span>}
			/>,
		);

		assert.match(html, /data-format="bmp"/);
		assert.match(html, /data-bmp-preview="calendar:800x480:16"/);
		assert.match(html, /BMP pipeline/);
	});

	it("renders the default PNG preview pipeline when selected", () => {
		const html = renderToStaticMarkup(
			<RecipePreviewStage
				slug="calendar"
				isPortrait={false}
				defaultFormat="png"
				pngPipeline={<span>PNG pipeline</span>}
			/>,
		);

		assert.match(html, /data-format="png"/);
		assert.match(
			html,
			/data-image-endpoint="PNG preview:800x480:\/api\/png\/calendar\/default\.png\?width=800&amp;height=480"/,
		);
		assert.match(html, /PNG pipeline/);
	});

	it("uses an explicit PNG endpoint URL when provided", () => {
		const html = renderToStaticMarkup(
			<RecipePreviewStage
				slug="weather"
				isPortrait={false}
				defaultFormat="png"
				pngUrl="/api/png/weather/screen-1.png"
			/>,
		);

		assert.match(
			html,
			/data-image-endpoint="PNG preview:800x480:\/api\/png\/weather\/screen-1\.png\?width=800&amp;height=480"/,
		);
	});

	it("passes the source format label to preview controls", () => {
		const html = renderToStaticMarkup(
			<RecipePreviewStage
				slug="liquid-card"
				isPortrait={false}
				reactNode={<div>liquid-preview</div>}
				reactLabel="LIQUID"
			/>,
		);

		assert.match(html, /data-react-label="LIQUID"/);
	});
});
