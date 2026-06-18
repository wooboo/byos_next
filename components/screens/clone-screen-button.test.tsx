import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import { CloneScreenButton } from "./clone-screen-button";

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
	cloneScreen: vi.fn(async () => ({
		success: true,
		screen: { id: "screen-copy", name: "Lobby copy" },
	})),
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

describe("CloneScreenButton", () => {
	it("renders the clone action label in the idle state", () => {
		const html = renderToStaticMarkup(<CloneScreenButton id="screen-1" />);

		assert.match(html, />Clone</);
		assert.doesNotMatch(html, /Cloning\.\.\./);
	});

	it("clones the screen and navigates to the new copy", async () => {
		const { cloneScreen } = await import("@/app/actions/screens");

		renderToStaticMarkup(<CloneScreenButton id="screen-1" />);
		await state.buttonProps?.onClick?.(
			{} as React.MouseEvent<HTMLButtonElement>,
		);

		assert.deepEqual(vi.mocked(cloneScreen).mock.calls, [["screen-1"]]);
		assert.deepEqual(state.push.mock.calls, [["/screens/screen-copy"]]);
	});

	it("renders the pending label while cloning is in progress", () => {
		state.isPending = true;
		const html = renderToStaticMarkup(<CloneScreenButton id="screen-1" />);
		state.isPending = false;

		assert.match(html, /Cloning\.\.\./);
		assert.match(html, /disabled=""/);
	});
});
