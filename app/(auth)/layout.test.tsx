import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import AuthLayout from "./layout";

describe("Auth layout", () => {
	it("wraps auth routes in the auth background shell", async () => {
		const html = renderToStaticMarkup(
			await AuthLayout({
				children: <div>auth child</div>,
			}),
		);

		assert.match(html, /min-h-screen/);
		assert.match(html, /bg-background/);
		assert.match(html, /auth child/);
	});
});
