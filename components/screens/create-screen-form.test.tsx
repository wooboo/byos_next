import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import {
	applyCreateScreenNameChange,
	applyCreateScreenRecipeSelection,
	canSubmitCreateScreenForm,
	createCreateScreenSubmitAction,
	getCreateScreenFormInitialState,
	getCreateScreenSubmitLabel,
	getScreenNameForRecipe,
	runCreateScreenSubmit,
	selectCreateScreenRecipe,
	submitCreateScreenForm,
} from "./create-screen-form";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: () => undefined }),
}));

vi.mock("sonner", () => ({
	toast: { error: () => undefined, success: () => undefined },
}));

vi.mock("@/app/actions/screens", () => ({
	createScreenFromRecipe: vi.fn(),
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
	Input: ({
		value,
		placeholder,
		id,
	}: {
		value?: string;
		placeholder?: string;
		id?: string;
	}) => <input id={id} value={value} placeholder={placeholder} readOnly />,
}));

vi.mock("@/components/ui/label", () => ({
	Label: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/select", () => ({
	Select: ({
		children,
		value,
	}: {
		children: React.ReactNode;
		value?: string;
	}) => <div data-select-value={value ?? ""}>{children}</div>,
	SelectContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectItem: ({
		children,
		value,
	}: {
		children: React.ReactNode;
		value: string;
	}) => <div data-select-item={value}>{children}</div>,
	SelectTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectValue: ({ placeholder }: { placeholder?: string }) => (
		<span>{placeholder}</span>
	),
}));

type CreateScreenFormModule = typeof import("./create-screen-form");
let moduleCache: CreateScreenFormModule | null = null;

async function getCreateScreenForm() {
	if (!moduleCache) {
		moduleCache = await import("./create-screen-form");
	}
	return moduleCache.CreateScreenForm;
}

describe("CreateScreenForm", () => {
	it("derives initial state, selected recipe names, and submit availability", () => {
		const recipes = [
			{ id: "recipe-1", name: "Weather", slug: "weather" },
			{ id: "recipe-2", name: "Calendar", slug: "calendar" },
		];

		assert.deepEqual(getCreateScreenFormInitialState(recipes), {
			recipeId: "recipe-1",
			name: "Weather",
		});
		assert.deepEqual(getCreateScreenFormInitialState([]), {
			recipeId: "",
			name: "",
		});
		assert.equal(getScreenNameForRecipe(recipes, "recipe-2"), "Calendar");
		assert.deepEqual(selectCreateScreenRecipe(recipes, "recipe-2"), {
			recipeId: "recipe-2",
			name: "Calendar",
		});
		assert.equal(getScreenNameForRecipe(recipes, "missing"), "");
		assert.equal(getCreateScreenSubmitLabel(true), "Creating…");
		assert.equal(getCreateScreenSubmitLabel(false), "Create screen");
		assert.equal(
			canSubmitCreateScreenForm({
				isPending: false,
				recipeId: "recipe-1",
				name: "Lobby weather",
			}),
			true,
		);
		assert.equal(
			canSubmitCreateScreenForm({
				isPending: false,
				recipeId: "recipe-1",
				name: "   ",
			}),
			false,
		);
	});

	it("wraps submit handlers with preventDefault and startTransition", () => {
		const event = { preventDefault: vi.fn() };
		const callback = vi.fn();
		const startTransition = vi.fn((run: () => void) => run());

		runCreateScreenSubmit(event, startTransition, callback);

		assert.equal(event.preventDefault.mock.calls.length, 1);
		assert.equal(startTransition.mock.calls.length, 1);
		assert.equal(callback.mock.calls.length, 1);
	});

	it("applies recipe selection, input changes, and composed submit actions", async () => {
		const recipes = [
			{ id: "recipe-1", name: "Weather", slug: "weather" },
			{ id: "recipe-2", name: "Calendar", slug: "calendar" },
		];
		const setRecipeId = vi.fn();
		const setName = vi.fn();

		applyCreateScreenRecipeSelection({
			recipes,
			recipeId: "recipe-2",
			setRecipeId,
			setName,
		});
		applyCreateScreenNameChange({
			value: "Lobby weather",
			setName,
		});

		assert.deepEqual(setRecipeId.mock.calls, [["recipe-2"]]);
		assert.deepEqual(setName.mock.calls, [["Calendar"], ["Lobby weather"]]);

		const push = vi.fn();
		const action = createCreateScreenSubmitAction({
			recipeId: "recipe-1",
			name: "Lobby weather",
			push,
			submit: vi.fn().mockResolvedValue(true),
		});
		await assert.doesNotReject(action);
	});

	it("submits create-screen requests through success and error paths", async () => {
		const notifications = {
			error: vi.fn(),
			success: vi.fn(),
		};
		const push = vi.fn();

		assert.equal(
			await submitCreateScreenForm({
				recipeId: "recipe-1",
				name: "Lobby weather",
				createScreen: vi.fn().mockResolvedValue({
					success: true,
					screen: { id: "screen-9" },
				}),
				push,
				notify: notifications as unknown as typeof import("sonner").toast,
			}),
			true,
		);
		assert.deepEqual(push.mock.calls, [["/screens/screen-9"]]);
		assert.deepEqual(notifications.success.mock.calls, [["Screen created"]]);

		assert.equal(
			await submitCreateScreenForm({
				recipeId: "recipe-1",
				name: "Lobby weather",
				createScreen: vi.fn().mockResolvedValue({
					success: false,
					error: "boom",
				}),
				push,
				notify: notifications as unknown as typeof import("sonner").toast,
			}),
			false,
		);
		assert.deepEqual(notifications.error.mock.calls.at(-1), [
			"Could not create screen",
			{ description: "boom" },
		]);
	});

	it("prefills the first recipe as the initial selection", async () => {
		const CreateScreenForm = await getCreateScreenForm();
		const html = renderToStaticMarkup(
			<CreateScreenForm
				recipes={[
					{ id: "recipe-1", name: "Weather", slug: "weather" },
					{ id: "recipe-2", name: "Calendar", slug: "calendar" },
				]}
			/>,
		);

		assert.match(html, /data-select-value="recipe-1"/);
		assert.match(html, /value="Weather"/);
		assert.match(html, /Calendar — work/);
		assert.doesNotMatch(html, /disabled=""/);
	});

	it("disables submission when there are no recipes", async () => {
		const CreateScreenForm = await getCreateScreenForm();
		const html = renderToStaticMarkup(<CreateScreenForm recipes={[]} />);

		assert.match(html, /data-select-value=""/);
		assert.match(html, /<button disabled="" type="submit">/);
	});
});
