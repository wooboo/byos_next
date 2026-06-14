import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import RecipeProps from "./recipe-props";

vi.mock("react-dom", async () => {
	const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
	return {
		...actual,
		useFormStatus: () => ({ pending: false }),
	};
});

vi.mock("@/components/ui/button", () => ({
	Button: ({ children }: { children: React.ReactNode }) => (
		<button type="button">{children}</button>
	),
}));

describe("RecipeProps", () => {
	it("renders nothing when the recipe has no props", () => {
		const html = renderToStaticMarkup(
			<RecipeProps
				props={{}}
				slug="weather"
				refreshAction={async () => undefined}
			/>,
		);

		assert.equal(html, "");
	});

	it("renders the refresh action and pretty-printed props when values exist", () => {
		const html = renderToStaticMarkup(
			<RecipeProps
				props={{ city: "Warsaw", limit: 5 }}
				slug="weather"
				refreshAction={async () => undefined}
			/>,
		);

		assert.match(html, /Recipe Props/);
		assert.match(html, /Re-run weather\/getData\.ts/);
		assert.match(html, /&quot;city&quot;: &quot;Warsaw&quot;/);
		assert.match(html, /&quot;limit&quot;: 5/);
	});
});
