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
	}: {
		format: string;
		className?: string;
	}) => (
		<div data-format={format} data-class-name={className ?? ""}>
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
});
