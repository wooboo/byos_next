import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	capturedProps: vi.fn(),
	useTheme: vi.fn(() => ({ theme: "dark" })),
}));

vi.mock("next-themes", () => ({
	useTheme: mocks.useTheme,
}));

vi.mock("sonner", () => ({
	Toaster: (props: Record<string, unknown>) => {
		mocks.capturedProps(props);
		return <div data-slot="sonner" />;
	},
}));

import { Toaster } from "./sonner";

describe("Toaster", () => {
	it("passes theme, icons, styles, and custom props to sonner", () => {
		const html = renderToStaticMarkup(<Toaster richColors expand />);
		const props = mocks.capturedProps.mock.calls[0]?.[0] as
			| Record<string, unknown>
			| undefined;

		assert.match(html, /data-slot="sonner"/);
		assert.equal(mocks.useTheme.mock.calls.length, 1);
		assert.equal(props?.theme, "dark");
		assert.equal(props?.className, "toaster group");
		assert.equal(props?.richColors, true);
		assert.equal(props?.expand, true);
		assert.equal(typeof props?.icons, "object");
		assert.equal(typeof props?.style, "object");
		assert.equal(
			(props?.style as Record<string, string> | undefined)?.["--border-radius"],
			"var(--radius)",
		);
	});
});
