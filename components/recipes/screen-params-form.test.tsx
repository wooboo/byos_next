import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import {
	applyResetScreenParamsForm,
	applySubmittedScreenParamsResult,
	buildInitialState,
	coerceFieldValue,
	hasScreenParams,
	isScreenParamsDirty,
	renderField,
	resetScreenParamsForm,
	ScreenParamsForm,
	submitScreenParams,
	updateScreenParamsValue,
} from "./screen-params-form";

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

vi.mock("next/navigation", () => ({
	useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/components/ui/input", () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
		<input {...props} readOnly />
	),
}));

vi.mock("@/components/ui/select", () => ({
	Select: ({
		children,
		value,
		onValueChange,
	}: {
		children: React.ReactNode;
		value?: string;
		onValueChange?: (value: string) => void;
	}) => (
		<div
			data-select-value={value}
			data-has-change-handler={String(Boolean(onValueChange))}
		>
			{children}
		</div>
	),
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

vi.mock("@/components/ui/label", () => ({
	Label: ({ children }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
		<div>{children}</div>
	),
}));

describe("ScreenParamsForm", () => {
	it("renders parameter defaults, descriptions, and a disabled save action before edits", () => {
		const html = renderToStaticMarkup(
			<ScreenParamsForm
				slug="weather"
				paramsSchema={{
					city: {
						type: "string",
						label: "City",
						description: "Shown in the header",
						default: "Warsaw",
						placeholder: "City name",
					},
					limit: {
						type: "number",
						label: "Limit",
						default: 7,
					},
				}}
				initialValues={{}}
				updateAction={async () => ({ success: true })}
			/>,
		);

		assert.match(html, /Parameters/);
		assert.match(html, /Shown in the header/);
		assert.match(html, /value="Warsaw"/);
		assert.match(html, /value="7"/);
		assert.match(html, /placeholder="City name"/);
		assert.match(html, /<button disabled="" type="submit">/);
	});

	it("returns no markup when the schema is empty", () => {
		const html = renderToStaticMarkup(
			<ScreenParamsForm
				slug="weather"
				paramsSchema={{}}
				initialValues={{}}
				updateAction={async () => ({ success: true })}
			/>,
		);

		assert.equal(html, "");
	});

	it("builds initial state and coerces numeric inputs consistently", () => {
		assert.deepEqual(
			buildInitialState(
				{
					city: { type: "string", label: "City", default: "Warsaw" },
					limit: { type: "number", label: "Limit", default: 7 },
					tag: { type: "string", label: "Tag" },
				},
				{ city: "Berlin", limit: null, tag: "" },
			),
			{
				city: "Berlin",
				limit: 7,
				tag: "",
			},
		);

		assert.equal(coerceFieldValue({ type: "number" }, "12"), 12);
		assert.equal(coerceFieldValue({ type: "number" }, "abc"), "");
		assert.equal(coerceFieldValue({ type: "string" }, "Paris"), "Paris");
	});

	it("renders text and number fields that report changes through their handlers", () => {
		const changes: Array<[string, unknown]> = [];
		const numberField = renderField(
			"limit",
			{ type: "number", label: "Limit" },
			3,
			(key, value) => changes.push([key, value]),
		);
		const textField = renderField(
			"city",
			{ type: "string", label: "City", placeholder: "Town" },
			"Rome",
			(key, value) => changes.push([key, value]),
		);

		assert.equal(numberField.props.type, "number");
		assert.equal(numberField.props.value, 3);
		numberField.props.onChange({ target: { value: "0" } });
		numberField.props.onChange({ target: { value: "oops" } });

		assert.equal(textField.props.type, "text");
		assert.equal(textField.props.placeholder, "Town");
		textField.props.onChange({ target: { value: "Milan" } });

		assert.deepEqual(changes, [
			["limit", 0],
			["limit", ""],
			["city", "Milan"],
		]);
	});

	it("renders option-backed strings as selects and booleans as checkboxes", () => {
		const changes: Array<[string, unknown]> = [];
		const selectField = renderField(
			"pattern",
			{
				type: "string",
				label: "Pattern",
				default: "overview",
				placeholder: "Pick pattern",
				options: [
					{ label: "Overview", value: "overview" },
					{ label: "Gradients", value: "gradients" },
				],
			},
			"gradients",
			(key, value) => changes.push([key, value]),
		);
		const checkboxField = renderField(
			"showLabels",
			{ type: "boolean", label: "Show labels", default: true },
			true,
			(key, value) => changes.push([key, value]),
		);

		assert.equal(selectField.props.value, "gradients");
		selectField.props.onValueChange("overview");
		assert.equal(checkboxField.props.type, "checkbox");
		assert.equal(checkboxField.props.checked, true);
		checkboxField.props.onChange({ target: { checked: false } });

		assert.deepEqual(changes, [
			["pattern", "overview"],
			["showLabels", false],
		]);
	});

	it("derives submit/reset state transitions and dirty checks", async () => {
		assert.equal(
			hasScreenParams({
				city: { type: "string", label: "City" },
			}),
			true,
		);
		assert.equal(hasScreenParams({}), false);
		assert.equal(
			isScreenParamsDirty({ city: "Rome" }, { city: "Rome" }),
			false,
		);
		assert.equal(
			isScreenParamsDirty({ city: "Milan" }, { city: "Rome" }),
			true,
		);

		assert.deepEqual(resetScreenParamsForm({ city: "Warsaw" }), {
			values: { city: "Warsaw" },
			formStatus: "idle",
			statusMessage: "",
		});

		assert.deepEqual(
			await submitScreenParams({
				slug: "weather",
				values: { city: "Rome" },
				paramsSchema: {
					city: { type: "string", label: "City" },
				},
				updateAction: async () => ({ success: true }),
			}),
			{
				formStatus: "success",
				statusMessage: "Saved",
			},
		);
		assert.deepEqual(
			await submitScreenParams({
				slug: "weather",
				values: { city: "Rome" },
				paramsSchema: {
					city: { type: "string", label: "City" },
				},
				updateAction: async () => ({ success: false }),
			}),
			{
				formStatus: "error",
				statusMessage: "Unable to save configuration",
			},
		);
		assert.deepEqual(
			await submitScreenParams({
				slug: "weather",
				values: { city: "Rome" },
				paramsSchema: {
					city: { type: "string", label: "City" },
				},
				updateAction: async () => ({
					success: false,
					error: "Validation failed",
				}),
			}),
			{
				formStatus: "error",
				statusMessage: "Validation failed",
			},
		);

		const submittedStatuses: string[] = [];
		const submittedMessages: string[] = [];
		const successCallbacks: string[] = [];
		applySubmittedScreenParamsResult({
			result: {
				formStatus: "success",
				statusMessage: "Saved",
			},
			setFormStatus: (status) => submittedStatuses.push(status),
			setStatusMessage: (message) => submittedMessages.push(message),
			onSuccess: () => successCallbacks.push("success"),
		});
		assert.deepEqual(submittedStatuses, ["success"]);
		assert.deepEqual(submittedMessages, ["Saved"]);
		assert.deepEqual(successCallbacks, ["success"]);

		const resetValues: Array<Record<string, unknown>> = [];
		const resetStatuses: string[] = [];
		const resetMessages: string[] = [];
		applyResetScreenParamsForm({
			initial: { city: "Warsaw" },
			setValues: (values) => resetValues.push(values),
			setFormStatus: (status) => resetStatuses.push(status),
			setStatusMessage: (message) => resetMessages.push(message),
		});
		assert.deepEqual(resetValues, [{ city: "Warsaw" }]);
		assert.deepEqual(resetStatuses, ["idle"]);
		assert.deepEqual(resetMessages, [""]);
		assert.deepEqual(updateScreenParamsValue({ city: "Warsaw" }, "limit", 5), {
			city: "Warsaw",
			limit: 5,
		});
	});
});
