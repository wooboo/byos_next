import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import {
	canSubmitScreenNameForm,
	getScreenNameSubmitLabel,
	isScreenNameDirty,
	runScreenNameSubmit,
	ScreenNameForm,
	submitScreenNameForm,
} from "./screen-name-form";

vi.mock("sonner", () => ({
	toast: { error: () => undefined, success: () => undefined },
}));

vi.mock("@/app/actions/screens", () => ({
	renameScreen: vi.fn(),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		disabled,
		type,
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button disabled={disabled} type={type}>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/input", () => ({
	Input: ({ value, id }: { value?: string; id?: string }) => (
		<input id={id} value={value} readOnly />
	),
}));

vi.mock("@/components/ui/label", () => ({
	Label: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("ScreenNameForm", () => {
	it("derives dirty state and submit availability from trimmed names", () => {
		assert.equal(isScreenNameDirty("Lobby weather", "Lobby weather"), false);
		assert.equal(isScreenNameDirty("Lobby weather ", "Lobby weather"), false);
		assert.equal(isScreenNameDirty("Transit board", "Lobby weather"), true);
		assert.equal(getScreenNameSubmitLabel(true), "Saving…");
		assert.equal(getScreenNameSubmitLabel(false), "Rename");
		assert.equal(
			canSubmitScreenNameForm({
				isPending: false,
				name: "Transit board",
				initialName: "Lobby weather",
			}),
			true,
		);
		assert.equal(
			canSubmitScreenNameForm({
				isPending: false,
				name: "   ",
				initialName: "Lobby weather",
			}),
			false,
		);
	});

	it("wraps rename submits with preventDefault and startTransition", () => {
		const event = { preventDefault: vi.fn() };
		const callback = vi.fn();
		const startTransition = vi.fn((run: () => void) => run());

		runScreenNameSubmit(event, startTransition, callback);

		assert.equal(event.preventDefault.mock.calls.length, 1);
		assert.equal(startTransition.mock.calls.length, 1);
		assert.equal(callback.mock.calls.length, 1);
	});

	it("submits rename requests through success and error paths", async () => {
		const notifications = {
			error: vi.fn(),
			success: vi.fn(),
		};

		assert.equal(
			await submitScreenNameForm({
				id: "screen-1",
				name: "Transit board",
				rename: vi.fn().mockResolvedValue({ success: true }),
				notify: notifications as unknown as typeof import("sonner").toast,
			}),
			true,
		);
		assert.deepEqual(notifications.success.mock.calls, [["Screen renamed"]]);

		assert.equal(
			await submitScreenNameForm({
				id: "screen-1",
				name: "Transit board",
				rename: vi.fn().mockResolvedValue({
					success: false,
					error: "duplicate",
				}),
				notify: notifications as unknown as typeof import("sonner").toast,
			}),
			false,
		);
		assert.deepEqual(notifications.error.mock.calls.at(-1), [
			"Could not rename screen",
			{ description: "duplicate" },
		]);
	});

	it("renders the initial screen name and keeps rename disabled before changes", () => {
		const html = renderToStaticMarkup(
			<ScreenNameForm id="screen-1" initialName="Lobby weather" />,
		);

		assert.match(html, /value="Lobby weather"/);
		assert.match(html, /<button disabled="" type="submit">Rename/);
	});
});
