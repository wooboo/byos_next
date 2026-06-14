import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

type AppLayoutComponent = typeof import("./layout.tsx").default;

async function getAppLayout(
	mode: "children" | "outer-fallback" | "inner-fallback",
) {
	vi.resetModules();
	let suspenseCallCount = 0;

	vi.doMock("react", async (importOriginal) => {
		const actual = await importOriginal<typeof import("react")>();
		return {
			...actual,
			Suspense: ({
				children,
				fallback,
			}: {
				children: React.ReactNode;
				fallback: React.ReactNode;
			}) => {
				suspenseCallCount += 1;
				if (
					(mode === "outer-fallback" && suspenseCallCount === 1) ||
					(mode === "inner-fallback" && suspenseCallCount === 2)
				) {
					return <>{fallback}</>;
				}
				return <>{children}</>;
			},
		};
	});

	vi.doMock("@/components/main-layout-server", () => ({
		default: ({ children }: { children: React.ReactNode }) => (
			<div data-main-layout>{children}</div>
		),
	}));

	vi.doMock("@/components/ui/skeleton", () => ({
		Skeleton: ({ className }: { className?: string }) => (
			<div className={className} />
		),
	}));

	return (await import("./layout.tsx")).default as AppLayoutComponent;
}

describe("app shell layout", () => {
	it("renders nested main layout around application children", async () => {
		const AppLayout = await getAppLayout("children");
		const html = renderToStaticMarkup(
			<AppLayout>
				<section>Route content</section>
			</AppLayout>,
		);

		assert.match(html, /data-main-layout/);
		assert.match(html, /Route content/);
	});

	it("renders the outer layout skeleton while the main shell is suspended", async () => {
		const AppLayout = await getAppLayout("outer-fallback");
		const html = renderToStaticMarkup(
			<AppLayout>
				<section>Route content</section>
			</AppLayout>,
		);

		assert.match(html, /min-h-screen flex flex-col/);
		assert.match(html, /w-56 border-r bg-background hidden md:block/);
		assert.match(html, /h-32 w-full rounded-md/);
	});

	it("renders the inner content fallback while route content is suspended", async () => {
		const AppLayout = await getAppLayout("inner-fallback");
		const html = renderToStaticMarkup(
			<AppLayout>
				<section>Route content</section>
			</AppLayout>,
		);

		assert.match(html, /data-main-layout/);
		assert.match(html, /p-6 space-y-6/);
		assert.match(html, /grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4/);
		assert.match(html, /border rounded-lg p-4 space-y-4/);
	});
});
