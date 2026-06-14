// @vitest-environment jsdom

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceDisplayMode } from "@/lib/mixup/constants";
import type { Device, RecipeSidebarItem } from "@/lib/types";

const routerState = vi.hoisted(() => ({
	push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: routerState.push,
	}),
}));

vi.mock("@/components/ui/command", () => ({
	CommandDialog: ({
		children,
		open,
		title,
		description,
	}: {
		children: React.ReactNode;
		open: boolean;
		title: string;
		description: string;
	}) => (
		<div data-slot="command-dialog" data-open={String(open)}>
			<h2>{title}</h2>
			<p>{description}</p>
			{children}
		</div>
	),
	CommandEmpty: ({ children }: { children: React.ReactNode }) => (
		<div data-slot="command-empty">{children}</div>
	),
	CommandGroup: ({
		children,
		heading,
	}: {
		children: React.ReactNode;
		heading: string;
	}) => (
		<section data-slot="command-group" data-heading={heading}>
			{children}
		</section>
	),
	CommandInput: ({
		placeholder,
		value,
		onValueChange,
	}: {
		placeholder: string;
		value: string;
		onValueChange: (value: string) => void;
	}) => (
		<input
			aria-label="Command input"
			data-slot="command-input"
			onChange={(event) => onValueChange(event.currentTarget.value)}
			placeholder={placeholder}
			value={value}
		/>
	),
	CommandItem: ({
		children,
		disabled,
		onSelect,
	}: {
		children: React.ReactNode;
		disabled?: boolean;
		onSelect?: () => void;
	}) => (
		<button disabled={disabled} onClick={onSelect} type="button">
			{children}
		</button>
	),
	CommandList: ({ children }: { children: React.ReactNode }) => (
		<div data-slot="command-list">{children}</div>
	),
	CommandSeparator: () => <hr data-slot="command-separator" />,
}));

import { CommandPalette } from "./command-palette";

const devices: Device[] = [
	{
		id: 1,
		name: "Kitchen",
		mac_address: "00:11:22:33:44:55",
		api_key: "api-key",
		friendly_id: "kitchen",
		screen: null,
		screen_id: null,
		screen_type: null,
		refresh_schedule: null,
		timezone: "UTC",
		last_update_time: null,
		next_expected_update: null,
		last_refresh_duration: null,
		battery_voltage: null,
		firmware_version: null,
		rssi: null,
		created_at: null,
		updated_at: null,
		playlist_id: null,
		mixup_id: null,
		display_mode: DeviceDisplayMode.SCREEN,
		current_playlist_index: null,
		user_id: null,
		screen_width: null,
		screen_height: null,
		screen_orientation: null,
		grayscale: null,
		model: null,
		palette_id: null,
	},
];

const recipeSidebarItems: RecipeSidebarItem[] = [
	{ slug: "weather", name: "Weather" },
];

let container: HTMLDivElement | null = null;
let root: Root | null = null;

async function render(element: React.ReactElement) {
	if (!container) {
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
	}

	await act(async () => {
		root?.render(element);
	});

	return container;
}

function getButton(text: string) {
	return Array.from(container?.querySelectorAll("button") ?? []).find(
		(button) => button.textContent?.includes(text),
	);
}

afterEach(async () => {
	routerState.push.mockReset();

	if (root) {
		await act(async () => {
			root?.unmount();
		});
	}

	container?.remove();
	container = null;
	root = null;
});

describe("command-palette", () => {
	it("renders navigation, device, recipe, and tool entries from public props", async () => {
		const mounted = await render(
			<CommandPalette
				open
				onOpenChange={vi.fn()}
				devices={devices}
				recipeSidebarItems={recipeSidebarItems}
				toolsComponents={[
					[
						"bitmap-font-designer",
						{
							title: "Bitmap Font Designer",
							published: true,
							createdAt: "2024-01-01",
							updatedAt: "2024-01-02",
							description: "Create fonts",
							tags: ["font"],
							author: { name: "Ada", github: "ada" },
							version: "1.0.0",
							category: "Utilities",
						},
					],
				]}
			/>,
		);

		expect(
			mounted
				.querySelector('[data-slot="command-dialog"]')
				?.getAttribute("data-open"),
		).toBe("true");
		expect(mounted.textContent).toContain("Command Palette");
		expect(mounted.textContent).toContain(
			"Search for devices, recipes, tools, and navigation",
		);
		expect(mounted.textContent).toContain("Overview");
		expect(mounted.textContent).toContain("Playlists");
		expect(mounted.textContent).toContain("Mixup");
		expect(mounted.textContent).toContain("System Log");
		expect(mounted.textContent).toContain("Kitchen");
		expect(mounted.textContent).toContain("kitchen");
		expect(mounted.textContent).toContain("All Recipes");
		expect(mounted.textContent).toContain("Weather");
		expect(mounted.textContent).toContain("All Tools");
		expect(mounted.textContent).toContain("Bitmap Font Designer");
		expect(
			mounted
				.querySelector('[aria-label="Command input"]')
				?.getAttribute("placeholder"),
		).toBe("Type a command or search...");
	});

	it("runs selected commands by closing the palette and navigating", async () => {
		const onOpenChange = vi.fn();

		await render(
			<CommandPalette
				open
				onOpenChange={onOpenChange}
				devices={devices}
				recipeSidebarItems={recipeSidebarItems}
				toolsComponents={[
					[
						"bitmap-font-designer",
						{
							title: "Bitmap Font Designer",
							published: true,
							createdAt: "2024-01-01",
							updatedAt: "2024-01-02",
							description: "Create fonts",
							tags: ["font"],
							author: { name: "Ada", github: "ada" },
							version: "1.0.0",
							category: "Utilities",
						},
					],
				]}
			/>,
		);

		for (const label of [
			"Overview",
			"Kitchen",
			"Weather",
			"Bitmap Font Designer",
		]) {
			await act(async () => {
				getButton(label)?.click();
			});
		}

		expect(onOpenChange).toHaveBeenCalledTimes(4);
		expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
		expect(routerState.push.mock.calls).toEqual([
			["/"],
			["/device/kitchen"],
			["/recipes/weather"],
			["/tools/bitmap-font-designer"],
		]);
	});

	it("toggles open state from the global keyboard shortcut", async () => {
		const changes: boolean[] = [];

		function Harness() {
			const [open, setOpen] = React.useState(false);

			return (
				<CommandPalette
					open={open}
					onOpenChange={(nextOpen) => {
						changes.push(nextOpen);
						setOpen(nextOpen);
					}}
					devices={devices}
					recipeSidebarItems={recipeSidebarItems}
					toolsComponents={[]}
				/>
			);
		}

		const mounted = await render(<Harness />);

		await act(async () => {
			const event = new KeyboardEvent("keydown", {
				key: "k",
				metaKey: true,
				cancelable: true,
			});
			document.dispatchEvent(event);
			expect(event.defaultPrevented).toBe(true);
		});

		expect(changes).toEqual([true]);
		expect(
			mounted
				.querySelector('[data-slot="command-dialog"]')
				?.getAttribute("data-open"),
		).toBe("true");

		await act(async () => {
			document.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "k",
					ctrlKey: true,
					cancelable: true,
				}),
			);
		});

		expect(changes).toEqual([true, false]);
		expect(
			mounted
				.querySelector('[data-slot="command-dialog"]')
				?.getAttribute("data-open"),
		).toBe("false");
	});

	it("renders the empty-device fallback when no devices are available", async () => {
		const mounted = await render(
			<CommandPalette
				open={false}
				onOpenChange={vi.fn()}
				devices={[]}
				recipeSidebarItems={[]}
				toolsComponents={[]}
			/>,
		);

		expect(
			mounted
				.querySelector('[data-slot="command-dialog"]')
				?.getAttribute("data-open"),
		).toBe("false");
		expect(mounted.textContent).toContain("No devices found");
		expect(mounted.textContent).toContain("No results found.");
		expect(getButton("No devices found")?.disabled).toBe(true);
	});
});
