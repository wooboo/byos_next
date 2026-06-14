import assert from "node:assert/strict";
import * as React from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, it, vi } from "vitest";

const toolPageState = vi.hoisted(() => ({
	notFoundCalls: 0,
}));

vi.mock("next/navigation", () => ({
	notFound: () => {
		toolPageState.notFoundCalls += 1;
		throw new Error("NOT_FOUND");
	},
}));

vi.mock(
	"@/app/(app)/tools/tools-components/bitmap-font-designer/bitmap-font-designer",
	() => ({
		default: () => <div>bitmap-font-tool</div>,
	}),
);

vi.mock(
	"@/app/(app)/tools/tools-components/image-ditherer/image-ditherer",
	() => ({
		default: () => <div>image-ditherer-tool</div>,
	}),
);

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

type ToolPageModule = typeof import("./page.tsx");
let moduleCache: ToolPageModule | null = null;

async function getModule() {
	if (!moduleCache) {
		moduleCache = await import("./page.tsx");
	}
	return moduleCache;
}

async function renderAsync(element: React.ReactElement) {
	const stream = await renderToReadableStream(element);
	await stream.allReady;
	return (await new Response(stream).text()).replaceAll("<!-- -->", "");
}

describe("Tool detail page", () => {
	it("returns metadata and renders the matching tool component", async () => {
		const module = await getModule();
		const metadata = await module.generateMetadata({
			params: Promise.resolve({ slug: "image-ditherer" }),
		});
		const html = await renderAsync(
			await module.default({
				params: Promise.resolve({ slug: "image-ditherer" }),
			}),
		);

		assert.equal(metadata.title, "1-Bit Image Ditherer");
		assert.match(html, /1-Bit Image Ditherer/);
		assert.match(html, /image-ditherer-tool/);
	});

	it("generates static params for all configured tools", async () => {
		const module = await getModule();
		const params = await module.generateStaticParams();

		assert.deepEqual(params, [
			{ slug: "image-ditherer" },
			{ slug: "bitmap-font-designer" },
		]);
	});

	it("delegates missing slugs to notFound", async () => {
		toolPageState.notFoundCalls = 0;
		const module = await getModule();

		await assert.rejects(
			async () =>
				module.default({
					params: Promise.resolve({ slug: "missing-tool" }),
				}),
			/NOT_FOUND/,
		);
		assert.equal(toolPageState.notFoundCalls, 1);
	});
});
