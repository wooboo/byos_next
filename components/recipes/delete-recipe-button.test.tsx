import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import { DeleteRecipeButton } from "./delete-recipe-button";

const state = vi.hoisted(() => ({
	buttonProps: null as React.ButtonHTMLAttributes<HTMLButtonElement> | null,
	isPending: false,
}));

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();

	return {
		...actual,
		useTransition: () => [
			state.isPending,
			(callback: () => Promise<unknown> | unknown) => callback(),
		],
	};
});

vi.mock("@/app/actions/catalog", () => ({
	deleteRecipe: vi.fn(),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		disabled,
		onClick,
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
		state.buttonProps = { disabled, onClick };
		return (
			<button type="button" disabled={disabled}>
				{children}
			</button>
		);
	},
}));

describe("DeleteRecipeButton", () => {
	it("renders the destructive action label in the idle state", () => {
		const html = renderToStaticMarkup(<DeleteRecipeButton slug="weather" />);

		assert.match(html, />Delete</);
		assert.doesNotMatch(html, /Deleting\.\.\./);
	});

	it("confirms before deleting and skips the action when the prompt is cancelled", async () => {
		const { deleteRecipe } = await import("@/app/actions/catalog");
		const confirmSpy = vi.fn();
		vi.stubGlobal("confirm", confirmSpy);

		renderToStaticMarkup(<DeleteRecipeButton slug="weather" />);
		confirmSpy.mockReturnValueOnce(false);
		state.buttonProps?.onClick?.({} as React.MouseEvent<HTMLButtonElement>);

		assert.equal(vi.mocked(deleteRecipe).mock.calls.length, 0);

		confirmSpy.mockReturnValueOnce(true);
		await state.buttonProps?.onClick?.(
			{} as React.MouseEvent<HTMLButtonElement>,
		);

		assert.deepEqual(vi.mocked(deleteRecipe).mock.calls, [["weather"]]);
		vi.unstubAllGlobals();
	});

	it("renders the pending label while deletion is in progress", () => {
		state.isPending = true;
		const html = renderToStaticMarkup(<DeleteRecipeButton slug="weather" />);
		state.isPending = false;

		assert.match(html, /Deleting\.\.\./);
		assert.match(html, /disabled=""/);
	});
});
