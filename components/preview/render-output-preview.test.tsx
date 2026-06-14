import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("next/image", () => ({
	default: ({
		src,
		alt,
		width,
		height,
	}: {
		src: string;
		alt: string;
		width: number;
		height: number;
	}) => (
		<div
			data-image-src={src}
			data-image-alt={alt}
			data-image-width={width}
			data-image-height={height}
		/>
	),
}));

import {
	EmptyRenderState,
	getRenderOutputMetadata,
	getScaledRenderPreviewStyle,
	RenderLoadingState,
	RenderOutputForFormat,
	RenderOutputImage,
	ScaledRenderPreview,
} from "./render-output-preview";

const encoded = {
	toString(encoding: "base64") {
		assert.equal(encoding, "base64");
		return "aGVsbG8=";
	},
};

describe("render output preview helpers", () => {
	it("derives shared preview metadata and scale styles", () => {
		assert.deepEqual(getRenderOutputMetadata("bitmap"), {
			errorLabel: "bitmap",
			imageType: "bmp",
			label: "BMP",
		});
		assert.deepEqual(getRenderOutputMetadata("png"), {
			errorLabel: "PNG",
			imageType: "png",
			label: "PNG",
		});
		assert.deepEqual(getScaledRenderPreviewStyle(800, 480), {
			container: {
				containerType: "inline-size",
			},
			content: {
				width: "800px",
				height: "480px",
				transform: "scale(calc(100cqi / 800px))",
				transformOrigin: "top left",
			},
		});
	});

	it("renders explicit empty and loading states", () => {
		const emptyHtml = renderToStaticMarkup(
			<EmptyRenderState>Nothing to render</EmptyRenderState>,
		);
		const loadingHtml = renderToStaticMarkup(
			<RenderLoadingState label="Rendering PNG…" />,
		);

		assert.match(emptyHtml, /Nothing to render/);
		assert.match(loadingHtml, /Rendering PNG…/);
		assert.match(loadingHtml, /animate-pulse/);
	});

	it("scales render previews to the requested bitmap dimensions", () => {
		const html = renderToStaticMarkup(
			<ScaledRenderPreview imageWidth={800} imageHeight={480}>
				<div>Rendered screen</div>
			</ScaledRenderPreview>,
		);

		assert.match(html, /Rendered screen/);
		assert.match(html, /width:800px/);
		assert.match(html, /height:480px/);
		assert.match(html, /transform:scale\(calc\(100cqi \/ 800px\)\)/);
	});

	it("renders a fallback message when an image is missing", () => {
		const html = renderToStaticMarkup(
			<RenderOutputImage
				format="bitmap"
				image={null}
				title="Weather"
				imageWidth={800}
				imageHeight={480}
			/>,
		);

		assert.match(html, /Failed to generate bitmap/);
	});

	it("renders data URLs and alt text for successful outputs", () => {
		const html = renderToStaticMarkup(
			<RenderOutputForFormat
				format="png"
				renders={{ png: encoded }}
				title="Transit board"
				imageWidth={600}
				imageHeight={448}
			/>,
		);

		assert.match(html, /data:image\/png;base64,aGVsbG8=/);
		assert.match(html, /data-image-alt="Transit board PNG render"/);
		assert.match(html, /data-image-width="600"/);
		assert.match(html, /data-image-height="448"/);
	});
});
