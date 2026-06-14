import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, it, vi } from "vitest";
import { MixupLayoutId } from "@/lib/mixup/constants";

vi.mock("@/components/common/screen-from-recipe", () => ({
	createScreenIdFromRecipe: vi.fn(),
	promptScreenName: vi.fn(),
}));

vi.mock("@/components/common/device-frame", () => ({
	DeviceFrame: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/preview/screen-preview-controls", () => ({
	useScreenPreviewControls: () => ({
		format: "bmp",
		setFormat: () => undefined,
		sizeIndex: 0,
		setSizeIndex: () => undefined,
		paletteIndex: 2,
		setPaletteIndex: () => undefined,
		isPortrait: false,
		setIsPortrait: () => undefined,
		width: 800,
		height: 480,
		grayscale: 16,
	}),
	ScreenPreviewControls: ({ className }: { className?: string }) => (
		<div data-preview-class={className ?? ""}>preview-controls</div>
	),
	screenPreviewSummary: ({
		width,
		height,
		grayscale,
	}: {
		width: number;
		height: number;
		grayscale: number;
	}) => `${width}x${height}:${grayscale}`,
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		ariaLabel,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
		ariaLabel?: string;
	}) => (
		<button type="button" aria-label={ariaLabel} {...props}>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/input", () => ({
	Input: ({ value, placeholder }: { value?: string; placeholder?: string }) => (
		<input value={value} placeholder={placeholder} readOnly />
	),
}));

vi.mock("@/components/ui/popover", () => ({
	Popover: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	PopoverTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	PopoverContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/command", () => ({
	Command: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	CommandEmpty: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	CommandGroup: ({
		children,
		heading,
	}: {
		children: React.ReactNode;
		heading?: string;
	}) => <section data-heading={heading ?? ""}>{children}</section>,
	CommandInput: ({ placeholder }: { placeholder?: string }) => (
		<input placeholder={placeholder} />
	),
	CommandItem: ({
		children,
		value,
	}: {
		children: React.ReactNode;
		value?: string;
	}) => <div data-command-value={value ?? ""}>{children}</div>,
	CommandList: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

type MixupBuilderModule = typeof import("./mixup-builder");
let moduleCache: MixupBuilderModule | null = null;

async function getMixupBuilder() {
	if (!moduleCache) {
		moduleCache = await import("./mixup-builder");
	}
	return moduleCache.MixupBuilder;
}

describe("MixupBuilder", () => {
	beforeEach(() => {
		moduleCache = null;
		vi.clearAllMocks();
	});

	it("renders editing state, slot counts, and preview urls for assigned content", async () => {
		const MixupBuilder = await getMixupBuilder();
		const html = renderToStaticMarkup(
			<MixupBuilder
				recipes={[
					{
						id: "recipe-1",
						slug: "weather",
						title: "Weather",
						description: "Forecast",
					},
					{ id: "recipe-2", slug: "calendar", title: "Calendar" },
				]}
				screens={[
					{ id: "screen-1", title: "Lobby screen", description: "Published" },
				]}
				initialData={{
					id: "mixup-1",
					name: "Front desk board",
					layout_id: MixupLayoutId.TOP_BANNER,
					assignments: {
						top: "recipe:recipe-1",
						"bottom-left": "screen:screen-1",
					},
				}}
				onSave={() => undefined}
				onCancel={() => undefined}
			/>,
		);

		assert.match(html, /Editing mixup/);
		assert.match(html, /value="Front desk board"/);
		assert.match(html, /2\/3/);
		assert.match(html, /Live preview/);
		assert.match(html, /Layout/);
		assert.match(html, /Slots/);
		assert.match(
			html,
			/\/api\/bitmap\/recipe-1\.bmp\?width=800&amp;height=240&amp;grayscale=16/,
		);
		assert.match(
			html,
			/\/api\/bitmap\/screen\/screen-1\.bmp\?width=400&amp;height=240&amp;grayscale=16/,
		);
		assert.match(html, /Forecast/);
		assert.match(html, /Published/);
		assert.match(html, /Back to mixups/);
		assert.match(html, />Update</);
	});

	it("renders a creation state with seeded recipe assignments", async () => {
		const MixupBuilder = await getMixupBuilder();
		const html = renderToStaticMarkup(
			<MixupBuilder
				recipes={[{ id: "recipe-1", slug: "weather", title: "Weather" }]}
				screens={[]}
				onSave={() => undefined}
			/>,
		);

		assert.match(html, /New mixup/);
		assert.match(html, /Untitled mixup/);
		assert.match(html, /slots filled/);
		assert.match(html, /Weather/);
		assert.match(html, />Create</);
		assert.doesNotMatch(html, /Back to mixups/);
	});

	it("normalizes content refs, removes assignments, and labels slot spans", async () => {
		const {
			normalizeContentRef,
			removeSlotAssignment,
			recipeTitleById,
			spanLabel,
		} = await import("./mixup-builder");

		assert.equal(normalizeContentRef("recipe:recipe-1"), "recipe:recipe-1");
		assert.equal(normalizeContentRef("screen:screen-1"), "screen:screen-1");
		assert.equal(normalizeContentRef("legacy-recipe"), "recipe:legacy-recipe");
		assert.deepEqual(
			removeSlotAssignment({ top: "recipe:1", bottom: "screen:2" }, "top"),
			{ bottom: "screen:2" },
		);
		assert.equal(
			recipeTitleById(
				[{ id: "recipe-1", slug: "weather", title: "Weather" }],
				"recipe-1",
			),
			"Weather",
		);
		assert.equal(recipeTitleById([], "missing"), "New screen");
		assert.equal(
			spanLabel({ id: "one", label: "One", x: 0, y: 0, width: 1, height: 1 }),
			"1 quarter",
		);
		assert.equal(
			spanLabel({
				id: "wide",
				label: "Wide",
				x: 0,
				y: 0,
				width: 1,
				height: 1,
				colSpan: 2,
				rowSpan: 2,
			}),
			"4 quarters",
		);
	});

	it("promotes recipe selections to created screens and preserves screen selections", async () => {
		const screenFromRecipe = await import(
			"@/components/common/screen-from-recipe"
		);
		vi.mocked(screenFromRecipe.createScreenIdFromRecipe).mockResolvedValueOnce(
			"screen-9",
		);
		const { createScreenValueFromRecipe, promoteRecipeValueToScreen } =
			await import("./mixup-builder");

		await assert.doesNotReject(async () => {
			assert.equal(
				await createScreenValueFromRecipe("recipe-1", "Weather screen"),
				"screen:screen-9",
			);
		});
		vi.mocked(screenFromRecipe.createScreenIdFromRecipe).mockResolvedValueOnce(
			null,
		);
		assert.equal(
			await createScreenValueFromRecipe("recipe-1", "Weather screen"),
			null,
		);
		assert.equal(
			await promoteRecipeValueToScreen("screen:screen-1", []),
			"screen:screen-1",
		);

		vi.mocked(screenFromRecipe.promptScreenName).mockReturnValueOnce(null);
		assert.equal(
			await promoteRecipeValueToScreen("recipe:recipe-2", [
				{ id: "recipe-2", slug: "calendar", title: "Calendar" },
			]),
			null,
		);
		vi.mocked(screenFromRecipe.promptScreenName).mockReset();
		vi.mocked(screenFromRecipe.createScreenIdFromRecipe).mockReset();

		vi.mocked(screenFromRecipe.promptScreenName).mockReturnValueOnce(
			"Calendar screen",
		);
		vi.mocked(screenFromRecipe.createScreenIdFromRecipe).mockResolvedValueOnce(
			"screen-10",
		);
		assert.equal(
			await promoteRecipeValueToScreen("recipe:recipe-2", [
				{ id: "recipe-2", slug: "calendar", title: "Calendar" },
			]),
			"screen:screen-10",
		);
		assert.deepEqual(
			vi.mocked(screenFromRecipe.createScreenIdFromRecipe).mock.calls.at(-1),
			["recipe-2", "Calendar screen"],
		);
	});
});
