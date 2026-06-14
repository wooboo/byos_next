import assert from "node:assert/strict";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import {
	type FrameData,
	PlaylistFrameSettings,
} from "./playlist-frame-settings";

type TestElement = React.ReactElement<
	Record<string, unknown>,
	React.ElementType
>;
type CallbackProps = {
	onClick?: () => void;
	onSelect?: () => void;
	onChange?: (event: { target: { value: string } }) => void;
	onValueChange?: (value: string[] | [number]) => void;
	"aria-label"?: string;
	id?: string;
	value?: string;
	children?: React.ReactNode;
};

function elementTypeName(element: TestElement) {
	return typeof element.type === "function" ? element.type.name : "";
}

function elementProps(element: TestElement) {
	return element.props;
}

function asCallbackElement(
	element: TestElement | undefined,
): React.ReactElement<CallbackProps, React.ElementType> | undefined {
	return element as
		| React.ReactElement<CallbackProps, React.ElementType>
		| undefined;
}

const frame: FrameData = {
	id: "frame-1",
	screen_id: "screen-1",
	screen_type: "screen",
	duration: 45,
	order_index: 0,
	start_time: "08:00",
	end_time: "12:00",
	days_of_week: ["monday", "wednesday"],
};

const screenOptions = [
	{
		label: "Screens",
		options: [{ id: "screen-1", name: "Lobby weather", type: "screen" }],
	},
];

function collectElements(
	node: React.ReactNode,
	predicate: (element: TestElement) => boolean,
	acc: TestElement[] = [],
) {
	if (Array.isArray(node)) {
		for (const child of node) {
			collectElements(child, predicate, acc);
		}
		return acc;
	}

	if (!isValidElement(node)) {
		return acc;
	}

	const element = node as TestElement;

	if (predicate(element)) {
		acc.push(element);
	}

	collectElements(
		elementProps(element).children as React.ReactNode,
		predicate,
		acc,
	);
	return acc;
}

describe("PlaylistFrameSettings", () => {
	it("renders the current selection and scheduling summary", () => {
		const html = renderToStaticMarkup(
			<PlaylistFrameSettings
				frame={frame}
				index={0}
				screenOptions={screenOptions}
				onUpdate={() => {}}
				onDelete={() => {}}
			/>,
		);

		assert.match(html, /Frame 1/);
		assert.match(html, /Lobby weather/);
		assert.match(html, /value="45"/);
		assert.match(html, /Clear/);
		assert.match(html, /Only shows on selected days\./);
		assert.match(html, /Active only in this window\./);
		assert.match(html, /aria-label="Delete frame"/);
	});

	it("renders fallback copy when the frame is always active", () => {
		const html = renderToStaticMarkup(
			<PlaylistFrameSettings
				frame={{
					...frame,
					screen_id: "missing",
					days_of_week: undefined,
					start_time: undefined,
					end_time: undefined,
				}}
				index={1}
				screenOptions={screenOptions}
				onUpdate={() => {}}
				onDelete={() => {}}
			/>,
		);

		assert.match(html, /Frame 2/);
		assert.match(html, /Select content/);
		assert.match(html, /Shows every day\./);
		assert.match(html, /Always active\./);
	});

	it("routes delete, select, duration, day, and time updates through the provided callbacks", () => {
		const updates: Array<{ id: string; patch: Partial<FrameData> }> = [];
		const deleted: string[] = [];
		const tree = PlaylistFrameSettings({
			frame,
			index: 0,
			screenOptions: [
				...screenOptions,
				{
					label: "Recipes",
					options: [{ id: "recipe-2", name: "Calendar", type: "recipe" }],
				},
			],
			onUpdate: (id, patch) => updates.push({ id, patch }),
			onDelete: (id) => deleted.push(id),
		});

		const allElements = collectElements(tree, () => true);
		const deleteButton = asCallbackElement(
			allElements.find(
				(element) => elementProps(element)["aria-label"] === "Delete frame",
			),
		);
		const commandItem = asCallbackElement(
			allElements.find(
				(element) =>
					typeof element.type === "function" &&
					elementTypeName(element) === "CommandItem" &&
					elementProps(element).value === "Recipes Calendar",
			),
		);
		const durationInput = asCallbackElement(
			allElements.find(
				(element) => elementProps(element).id === "duration-frame-1",
			),
		);
		const slider = asCallbackElement(
			allElements.find(
				(element) =>
					typeof element.type === "function" &&
					elementTypeName(element) === "Slider",
			),
		);
		const clearButton = asCallbackElement(
			allElements.find(
				(element) =>
					element.type === "button" &&
					elementProps(element).children === "Clear",
			),
		);
		const toggleGroup = asCallbackElement(
			allElements.find(
				(element) =>
					typeof element.type === "function" &&
					elementTypeName(element) === "ToggleGroup",
			),
		);
		const timeInputs = allElements.filter(
			(element) =>
				elementProps(element)["aria-label"] === "Start time" ||
				elementProps(element)["aria-label"] === "End time",
		) as Array<React.ReactElement<CallbackProps, React.ElementType>>;

		deleteButton?.props.onClick?.();
		commandItem?.props.onSelect?.();
		durationInput?.props.onChange?.({ target: { value: "0" } });
		slider?.props.onValueChange?.([0]);
		clearButton?.props.onClick?.();
		toggleGroup?.props.onValueChange?.([]);
		toggleGroup?.props.onValueChange?.(["friday"]);
		timeInputs
			.find((input) => input.props["aria-label"] === "Start time")
			?.props.onChange?.({
				target: { value: "" },
			});
		timeInputs
			.find((input) => input.props["aria-label"] === "End time")
			?.props.onChange?.({
				target: { value: "14:00" },
			});

		assert.deepEqual(deleted, ["frame-1"]);
		assert.deepEqual(updates, [
			{
				id: "frame-1",
				patch: { screen_id: "recipe-2", screen_type: "recipe" },
			},
			{ id: "frame-1", patch: { duration: 30 } },
			{ id: "frame-1", patch: { duration: 1 } },
			{ id: "frame-1", patch: { days_of_week: undefined } },
			{ id: "frame-1", patch: { days_of_week: undefined } },
			{ id: "frame-1", patch: { days_of_week: ["friday"] } },
			{ id: "frame-1", patch: { start_time: undefined } },
			{ id: "frame-1", patch: { end_time: "14:00" } },
		]);
	});
});
