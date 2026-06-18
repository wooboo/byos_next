import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import { DeleteScreenButton } from "./delete-screen-button";

const state = vi.hoisted(() => ({
	buttonProps: null as React.ButtonHTMLAttributes<HTMLButtonElement> | null,
	isPending: false,
	push: vi.fn(),
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

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: state.push,
	}),
}));

vi.mock("@/app/actions/screens", () => ({
	deleteScreen: vi.fn(async () => ({ success: true })),
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

describe("DeleteScreenButton", () => {
	it("renders the destructive action label in the idle state", () => {
		const html = renderToStaticMarkup(
			<DeleteScreenButton id="screen-1" name="Lobby" />,
		);

		assert.match(html, />Delete</);
		assert.doesNotMatch(html, /Deleting\.\.\./);
	});

	it("confirms before deleting and returns to the screens list", async () => {
		const { deleteScreen } = await import("@/app/actions/screens");
		const confirmSpy = vi.fn();
		vi.stubGlobal("confirm", confirmSpy);

		renderToStaticMarkup(<DeleteScreenButton id="screen-1" name="Lobby" />);
		confirmSpy.mockReturnValueOnce(false);
		state.buttonProps?.onClick?.({} as React.MouseEvent<HTMLButtonElement>);

		assert.equal(vi.mocked(deleteScreen).mock.calls.length, 0);
		assert.equal(state.push.mock.calls.length, 0);

		confirmSpy.mockReturnValueOnce(true);
		await state.buttonProps?.onClick?.(
			{} as React.MouseEvent<HTMLButtonElement>,
		);

		assert.deepEqual(vi.mocked(deleteScreen).mock.calls, [["screen-1"]]);
		assert.deepEqual(state.push.mock.calls, [["/screens"]]);
		vi.unstubAllGlobals();
	});

	it("renders the pending label while deletion is in progress", () => {
		state.isPending = true;
		const html = renderToStaticMarkup(
			<DeleteScreenButton id="screen-1" name="Lobby" />,
		);
		state.isPending = false;

		assert.match(html, /Deleting\.\.\./);
		assert.match(html, /disabled=""/);
	});
});
