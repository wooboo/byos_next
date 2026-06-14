// @ts-expect-error jsdom has no bundled declarations in this project.
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentConfig } from "@/components/sidebar-types";
import { DeviceDisplayMode } from "@/lib/mixup/constants";
import type { Device, RecipeSidebarItem } from "@/lib/types";

const sidebarState = vi.hoisted(() => ({
	mouseEnterHandlers: [] as Array<() => void>,
	prefetch: vi.fn(),
	refresh: vi.fn(),
	addUserDevice: vi.fn(),
	toastSuccess: vi.fn(),
	toastError: vi.fn(),
	getDeviceStatus: vi.fn(() => "online"),
	inputChangeHandlers: {} as Record<
		string,
		(event: { target: { value: string } }) => void
	>,
}));

vi.mock("next/image", () => ({
	default: ({
		src,
		alt,
		...props
	}: React.ComponentProps<"img"> & { src: string; alt: string }) => (
		// biome-ignore lint/performance/noImgElement: test double for next/image output
		<img src={src} alt={alt} {...props} />
	),
}));

vi.mock("next/link", () => ({
	default: ({
		href,
		children,
		...props
	}: React.ComponentProps<"a"> & { href: string }) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		prefetch: sidebarState.prefetch,
		refresh: sidebarState.refresh,
	}),
}));

vi.mock("sonner", () => ({
	toast: {
		success: sidebarState.toastSuccess,
		error: sidebarState.toastError,
	},
}));

vi.mock("@/app/actions/device", () => ({
	addUserDevice: sidebarState.addUserDevice,
}));

vi.mock("@/components/common/status-indicator", () => ({
	StatusIndicator: ({ status }: { status: string }) => (
		<span data-slot="status-indicator">{status}</span>
	),
}));

vi.mock("@/components/nav-user", () => ({
	NavUser: ({ user }: { user: { email: string } }) => (
		<div data-slot="nav-user">{user.email}</div>
	),
}));

vi.mock("@/components/ui/badge", () => ({
	Badge: ({ children }: { children: React.ReactNode }) => (
		<span data-slot="badge">{children}</span>
	),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		onClick,
		disabled,
		title,
		type = "button",
		...props
	}: React.ComponentProps<"button">) => (
		<button
			type={type}
			onClick={onClick}
			disabled={disabled}
			title={title}
			{...props}
		>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/collapsible", () => ({
	Collapsible: ({ children }: { children: React.ReactNode }) => (
		<div data-slot="collapsible">{children}</div>
	),
	CollapsibleContent: ({ children }: { children: React.ReactNode }) => (
		<div data-slot="collapsible-content">{children}</div>
	),
	CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => (
		<div data-slot="collapsible-trigger">{children}</div>
	),
}));

vi.mock("@/components/ui/dialog", () => ({
	Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
		open ? <div data-slot="dialog">{children}</div> : null,
	DialogContent: ({ children }: { children: React.ReactNode }) => (
		<div data-slot="dialog-content">{children}</div>
	),
	DialogDescription: ({ children }: { children: React.ReactNode }) => (
		<p data-slot="dialog-description">{children}</p>
	),
	DialogFooter: ({ children }: { children: React.ReactNode }) => (
		<div data-slot="dialog-footer">{children}</div>
	),
	DialogHeader: ({ children }: { children: React.ReactNode }) => (
		<div data-slot="dialog-header">{children}</div>
	),
	DialogTitle: ({ children }: { children: React.ReactNode }) => (
		<h2 data-slot="dialog-title">{children}</h2>
	),
}));

vi.mock("@/components/ui/input", () => ({
	Input: ({ id, onChange, ...props }: React.ComponentProps<"input">) => {
		if (id && onChange) {
			sidebarState.inputChangeHandlers[id] = onChange as (event: {
				target: { value: string };
			}) => void;
		}

		return <input id={id} onChange={onChange} {...props} />;
	},
}));

vi.mock("@/components/ui/label", () => ({
	Label: ({
		children,
		...props
	}: React.ComponentProps<"label"> & { children: React.ReactNode }) => (
		<span {...props}>{children}</span>
	),
}));

vi.mock("@/components/ui/sidebar", () => ({
	Sidebar: ({ children }: { children: React.ReactNode }) => (
		<nav data-slot="sidebar">{children}</nav>
	),
	SidebarContent: ({ children }: { children: React.ReactNode }) => (
		<div data-slot="sidebar-content">{children}</div>
	),
	SidebarFooter: ({ children }: { children: React.ReactNode }) => (
		<footer data-slot="sidebar-footer">{children}</footer>
	),
	SidebarGroup: ({ children }: { children: React.ReactNode }) => (
		<section data-slot="sidebar-group">{children}</section>
	),
	SidebarGroupContent: ({ children }: { children: React.ReactNode }) => (
		<div data-slot="sidebar-group-content">{children}</div>
	),
	SidebarHeader: ({ children }: { children: React.ReactNode }) => (
		<header data-slot="sidebar-header">{children}</header>
	),
	SidebarMenu: ({ children }: { children: React.ReactNode }) => (
		<ul data-slot="sidebar-menu">{children}</ul>
	),
	SidebarMenuButton: ({
		children,
		isActive,
		tooltip,
		onMouseEnter,
	}: {
		children: React.ReactNode;
		isActive?: boolean;
		tooltip?: string;
		onMouseEnter?: () => void;
	}) => {
		if (onMouseEnter) {
			sidebarState.mouseEnterHandlers.push(onMouseEnter);
		}

		return (
			<li
				data-slot="sidebar-menu-button"
				data-active={isActive}
				data-tooltip={tooltip}
			>
				{children}
			</li>
		);
	},
	SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
		<li data-slot="sidebar-menu-item">{children}</li>
	),
	SidebarMenuSub: ({ children }: { children: React.ReactNode }) => (
		<ul data-slot="sidebar-menu-sub">{children}</ul>
	),
	SidebarMenuSubButton: ({
		children,
		isActive,
		onMouseEnter,
	}: {
		children: React.ReactNode;
		isActive?: boolean;
		onMouseEnter?: () => void;
	}) => {
		if (onMouseEnter) {
			sidebarState.mouseEnterHandlers.push(onMouseEnter);
		}

		return (
			<li data-slot="sidebar-menu-sub-button" data-active={isActive}>
				{children}
			</li>
		);
	},
	SidebarMenuSubItem: ({ children }: { children: React.ReactNode }) => (
		<li data-slot="sidebar-menu-sub-item">{children}</li>
	),
}));

vi.mock("@/utils/helpers", () => ({
	getDeviceStatus: sidebarState.getDeviceStatus,
}));

import { AppSidebar } from "./app-sidebar";

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

const toolsComponents: [string, ComponentConfig][] = [
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
];

interface MountedSidebar {
	cleanup: () => void;
	container: HTMLDivElement;
	window: Window & typeof globalThis;
}

function mountSidebar(element: React.ReactElement): MountedSidebar {
	const dom = new JSDOM("<!doctype html><html><body></body></html>", {
		url: "http://localhost",
	});
	const previousGlobals = {
		document: globalThis.document,
		HTMLElement: globalThis.HTMLElement,
		Node: globalThis.Node,
		navigator: globalThis.navigator,
		window: globalThis.window,
	};

	globalThis.window = dom.window as unknown as typeof globalThis.window;
	globalThis.document = dom.window.document;
	globalThis.HTMLElement = dom.window.HTMLElement;
	globalThis.Node = dom.window.Node;
	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: dom.window.navigator,
	});
	Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
		configurable: true,
		value: true,
	});

	const clipboard = { writeText: vi.fn() };
	Object.defineProperty(dom.window.navigator, "clipboard", {
		configurable: true,
		value: clipboard,
	});

	const container = dom.window.document.createElement("div");
	dom.window.document.body.append(container);
	const root = createRoot(container);

	act(() => {
		root.render(element);
	});

	return {
		container,
		window: dom.window as unknown as Window & typeof globalThis,
		cleanup: () => {
			act(() => {
				root.unmount();
			});
			dom.window.close();
			globalThis.window = previousGlobals.window;
			globalThis.document = previousGlobals.document;
			globalThis.HTMLElement = previousGlobals.HTMLElement;
			globalThis.Node = previousGlobals.Node;
			Object.defineProperty(globalThis, "navigator", {
				configurable: true,
				value: previousGlobals.navigator,
			});
		},
	};
}

function click(window: Window, element: Element) {
	act(() => {
		const eventWindow = window as Window & typeof globalThis;
		element.dispatchEvent(
			new eventWindow.MouseEvent("click", { bubbles: true }),
		);
	});
}

function changeInput(input: HTMLInputElement, value: string) {
	act(() => {
		sidebarState.inputChangeHandlers[input.id]?.({
			target: { value },
		});
	});
}

function findButtonByText(container: HTMLElement, text: string) {
	return Array.from(container.querySelectorAll("button")).find((button) =>
		button.textContent?.includes(text),
	);
}

describe("app-sidebar", () => {
	afterEach(() => {
		sidebarState.mouseEnterHandlers = [];
		sidebarState.prefetch.mockReset();
		sidebarState.refresh.mockReset();
		sidebarState.addUserDevice.mockReset();
		sidebarState.toastSuccess.mockReset();
		sidebarState.toastError.mockReset();
		sidebarState.getDeviceStatus.mockReset();
		sidebarState.getDeviceStatus.mockReturnValue("online");
		sidebarState.inputChangeHandlers = {};
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("renders populated navigation sections, device status, and signed-in footer", () => {
		const html = renderToStaticMarkup(
			<AppSidebar
				devices={devices}
				recipeSidebarItems={recipeSidebarItems}
				toolsComponents={toolsComponents}
				currentPath="/device/kitchen"
				user={{
					name: "Ada",
					email: "ada@example.com",
					image: null,
					role: "admin",
				}}
				authEnabled
			/>,
		);

		expect(html).toContain('src="/trmnl-icons/trmnl-icon--white.svg"');
		expect(html).toContain(">TRMNL BYOS<");
		expect(html).toContain('data-slot="badge"');
		expect(html).toContain(">beta<");
		expect(html).toContain('href="/device/kitchen"');
		expect(html).toContain(">Kitchen<");
		expect(html).toContain('data-slot="status-indicator"');
		expect(html).toContain(">online<");
		expect(html).toContain('href="/recipes/weather"');
		expect(html).toContain(">Weather<");
		expect(html).toContain('href="/tools/bitmap-font-designer"');
		expect(html).toContain(">Bitmap Font Designer<");
		expect(html).toContain('href="/system-logs"');
		expect(html).toContain('data-slot="nav-user"');
		expect(html).toContain(">ada@example.com<");
		expect(html).toContain("/trmnl-glyphs/trmnl-glyph--brand.svg");
		expect(html).toMatch(/>v\d+\.\d+\.\d+</);
		expect(html).toContain('data-active="true"');
		expect(html).toContain(">Add device<");
	});

	it("prefetches sidebar destinations from hover handlers", () => {
		renderToStaticMarkup(
			<AppSidebar
				devices={devices}
				recipeSidebarItems={recipeSidebarItems}
				toolsComponents={toolsComponents}
				currentPath="/tools"
				user={null}
				authEnabled={false}
			/>,
		);

		for (const handler of sidebarState.mouseEnterHandlers) {
			handler();
		}

		expect(sidebarState.prefetch.mock.calls).toEqual([
			["/"],
			["/device/kitchen"],
			["/recipes"],
			["/recipes/weather"],
			["/screens"],
			["/playlists"],
			["/mixup"],
			["/catalog"],
			["/tools"],
			["/tools/bitmap-font-designer"],
			["/system-logs"],
		]);
	});

	it("renders the empty devices fallback and omits auth-only controls when auth is disabled", () => {
		const html = renderToStaticMarkup(
			<AppSidebar
				devices={[]}
				recipeSidebarItems={[]}
				toolsComponents={[]}
				currentPath="/recipes"
				user={null}
				authEnabled={false}
			/>,
		);

		expect(html).toContain(">No devices found<");
		expect(html).toContain('href="/recipes"');
		expect(html).toContain(">All Recipes<");
		expect(html).toContain('data-active="true"');
		expect(html).not.toContain('data-slot="nav-user"');
		expect(html).not.toContain(">Add device<");
		expect(html).not.toContain('data-slot="dialog"');
	});

	it("opens the add-device dialog, generates and copies a key, then closes it", () => {
		const sidebar = mountSidebar(
			<AppSidebar
				devices={devices}
				recipeSidebarItems={recipeSidebarItems}
				toolsComponents={toolsComponents}
				currentPath="/"
				user={null}
				authEnabled
			/>,
		);

		try {
			const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
			const openDialogButton = findButtonByText(
				sidebar.container,
				"Add device",
			);
			expect(openDialogButton).toBeDefined();

			click(sidebar.window, openDialogButton as HTMLButtonElement);
			expect(sidebar.container.textContent).toContain("Add a Device");

			const apiKeyInput = sidebar.container.querySelector(
				"#device-api-key",
			) as HTMLInputElement | null;
			expect(apiKeyInput?.value).toBe("");

			const generateButton = sidebar.container.querySelector(
				'button[title="Generate random key"]',
			);
			expect(generateButton).toBeDefined();
			click(sidebar.window, generateButton as HTMLButtonElement);

			expect(apiKeyInput?.value).toBe("aaaaaaaaaaaaaaaaaaaaaa");

			const copyButton = sidebar.container.querySelector(
				'button[title="Copy API key"]',
			);
			expect(copyButton).toBeDefined();
			click(sidebar.window, copyButton as HTMLButtonElement);

			expect(sidebar.window.navigator.clipboard.writeText).toHaveBeenCalledWith(
				"aaaaaaaaaaaaaaaaaaaaaa",
			);
			expect(sidebarState.toastSuccess).toHaveBeenCalledWith("API key copied!");

			const cancelButton = findButtonByText(sidebar.container, "Cancel");
			expect(cancelButton).toBeDefined();
			click(sidebar.window, cancelButton as HTMLButtonElement);
			expect(sidebar.container.textContent).not.toContain("Add a Device");

			randomSpy.mockRestore();
		} finally {
			sidebar.cleanup();
		}
	});

	it("submits a new device successfully and refreshes the sidebar", async () => {
		let resolveRequest:
			| ((value: { success: true; apiKey: string }) => void)
			| null = null;
		sidebarState.addUserDevice.mockImplementation(
			() =>
				new Promise<{ success: true; apiKey: string }>((resolve) => {
					resolveRequest = resolve;
				}),
		);

		const sidebar = mountSidebar(
			<AppSidebar
				devices={devices}
				recipeSidebarItems={recipeSidebarItems}
				toolsComponents={toolsComponents}
				currentPath="/"
				user={null}
				authEnabled
			/>,
		);

		try {
			click(
				sidebar.window,
				findButtonByText(sidebar.container, "Add device") as HTMLButtonElement,
			);

			const apiKeyInput = sidebar.container.querySelector(
				"#device-api-key",
			) as HTMLInputElement;
			const deviceNameInput = sidebar.container.querySelector(
				"#device-name",
			) as HTMLInputElement;
			expect(
				(findButtonByText(sidebar.container, "Add Device") as HTMLButtonElement)
					.disabled,
			).toBe(true);

			changeInput(apiKeyInput, "client-api-key");
			changeInput(deviceNameInput, "Kitchen 2");
			const submitButton = findButtonByText(
				sidebar.container,
				"Add Device",
			) as HTMLButtonElement;
			expect(submitButton.disabled).toBe(false);

			await act(async () => {
				submitButton.dispatchEvent(
					new sidebar.window.MouseEvent("click", { bubbles: true }),
				);
			});

			expect(sidebarState.addUserDevice).toHaveBeenCalledWith({
				apiKey: "client-api-key",
				name: "Kitchen 2",
			});
			expect(submitButton.textContent).toContain("Adding...");
			expect(submitButton.disabled).toBe(true);

			await act(async () => {
				resolveRequest?.({ success: true, apiKey: "server-api-key" });
				await Promise.resolve();
			});

			expect(sidebarState.toastSuccess).toHaveBeenCalledWith(
				"Device added! API key: server-api-key",
			);
			expect(sidebarState.refresh).toHaveBeenCalledTimes(1);
			expect(sidebar.container.textContent).not.toContain("Add a Device");
		} finally {
			sidebar.cleanup();
		}
	});

	it("shows an action error and keeps the dialog open when addUserDevice fails", async () => {
		sidebarState.addUserDevice.mockResolvedValue({
			success: false,
			error: "Duplicate API key",
		});

		const sidebar = mountSidebar(
			<AppSidebar
				devices={devices}
				recipeSidebarItems={recipeSidebarItems}
				toolsComponents={toolsComponents}
				currentPath="/"
				user={null}
				authEnabled
			/>,
		);

		try {
			click(
				sidebar.window,
				findButtonByText(sidebar.container, "Add device") as HTMLButtonElement,
			);

			changeInput(
				sidebar.container.querySelector("#device-api-key") as HTMLInputElement,
				"duplicate-key",
			);

			await act(async () => {
				(
					findButtonByText(sidebar.container, "Add Device") as HTMLButtonElement
				).dispatchEvent(
					new sidebar.window.MouseEvent("click", { bubbles: true }),
				);
				await Promise.resolve();
			});

			expect(sidebarState.toastError).toHaveBeenCalledWith("Duplicate API key");
			expect(sidebarState.refresh).not.toHaveBeenCalled();
			expect(sidebar.container.textContent).toContain("Add a Device");
		} finally {
			sidebar.cleanup();
		}
	});

	it("shows the fallback error when the add device action throws", async () => {
		sidebarState.addUserDevice.mockRejectedValue(new Error("network"));

		const sidebar = mountSidebar(
			<AppSidebar
				devices={devices}
				recipeSidebarItems={recipeSidebarItems}
				toolsComponents={toolsComponents}
				currentPath="/"
				user={null}
				authEnabled
			/>,
		);

		try {
			click(
				sidebar.window,
				findButtonByText(sidebar.container, "Add device") as HTMLButtonElement,
			);

			changeInput(
				sidebar.container.querySelector("#device-api-key") as HTMLInputElement,
				"throwing-key",
			);

			await act(async () => {
				(
					findButtonByText(sidebar.container, "Add Device") as HTMLButtonElement
				).dispatchEvent(
					new sidebar.window.MouseEvent("click", { bubbles: true }),
				);
				await Promise.resolve();
			});

			expect(sidebarState.toastError).toHaveBeenCalledWith(
				"Failed to add device",
			);
			expect(sidebarState.refresh).not.toHaveBeenCalled();
			expect(
				(findButtonByText(sidebar.container, "Add Device") as HTMLButtonElement)
					.disabled,
			).toBe(false);
		} finally {
			sidebar.cleanup();
		}
	});

	it("refreshes device status on an interval", () => {
		vi.useFakeTimers();
		sidebarState.getDeviceStatus
			.mockReturnValueOnce("offline")
			.mockReturnValueOnce("offline")
			.mockReturnValueOnce("online");

		const sidebar = mountSidebar(
			<AppSidebar
				devices={devices}
				recipeSidebarItems={recipeSidebarItems}
				toolsComponents={toolsComponents}
				currentPath="/device/kitchen"
				user={null}
				authEnabled={false}
			/>,
		);

		try {
			expect(sidebar.container.textContent).toContain("offline");

			act(() => {
				vi.advanceTimersByTime(30000);
			});

			expect(sidebar.container.textContent).toContain("online");
		} finally {
			sidebar.cleanup();
		}
	});
});
