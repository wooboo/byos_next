import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	isMobile: false,
	lastButtonProps: null as React.ComponentProps<"button"> | null,
}));

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		variant,
		size,
		className,
		...props
	}: React.ComponentProps<"button"> & {
		variant?: string;
		size?: string;
	}) => {
		state.lastButtonProps = props;

		return (
			<button
				data-slot="button"
				data-variant={variant}
				data-size={size}
				className={className}
				{...props}
			>
				{children}
			</button>
		);
	},
}));

vi.mock("@/components/ui/sheet", () => ({
	Sheet: ({
		children,
		open,
	}: React.ComponentProps<"div"> & { open?: boolean }) => (
		<div data-slot="sheet" data-open={open}>
			{children}
		</div>
	),
	SheetContent: ({
		children,
		side,
		...props
	}: React.ComponentProps<"div"> & { side?: string }) => (
		<div {...props} data-slot="sheet-content" data-side={side}>
			{children}
		</div>
	),
	SheetDescription: ({ children, ...props }: React.ComponentProps<"p">) => (
		<p data-slot="sheet-description" {...props}>
			{children}
		</p>
	),
	SheetHeader: ({ children, ...props }: React.ComponentProps<"div">) => (
		<div data-slot="sheet-header" {...props}>
			{children}
		</div>
	),
	SheetTitle: ({ children, ...props }: React.ComponentProps<"h2">) => (
		<h2 data-slot="sheet-title" {...props}>
			{children}
		</h2>
	),
}));

vi.mock("@/components/ui/tooltip", () => ({
	TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
	Tooltip: ({ children }: { children: React.ReactNode }) => (
		<div data-slot="tooltip">{children}</div>
	),
	TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
		<div data-slot="tooltip-trigger">{children}</div>
	),
	TooltipContent: ({
		children,
		hidden,
		...props
	}: React.ComponentProps<"div"> & { hidden?: boolean }) => (
		<div data-slot="tooltip-content" hidden={hidden} {...props}>
			{children}
		</div>
	),
}));

vi.mock("@/hooks/use-mobile", () => ({
	useIsMobile: () => state.isMobile,
}));

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInput,
	SidebarInset,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	SidebarProvider,
	SidebarRail,
	SidebarSeparator,
	SidebarTrigger,
	useSidebar,
} from "./sidebar";

describe("sidebar", () => {
	afterEach(() => {
		state.isMobile = false;
		state.lastButtonProps = null;
		globalThis.window = originalWindow;
		globalThis.document = originalDocument;
		vi.restoreAllMocks();
	});

	it("renders collapsed desktop sidebar affordances and menu slots", () => {
		vi.spyOn(Math, "random").mockReturnValue(0);

		const html = renderToStaticMarkup(
			<SidebarProvider defaultOpen={false} className="shell">
				<Sidebar
					side="right"
					variant="floating"
					collapsible="icon"
					className="nav"
				>
					<SidebarHeader>Header</SidebarHeader>
					<SidebarContent>
						<SidebarGroup>
							<SidebarGroupLabel>Library</SidebarGroupLabel>
							<SidebarGroupAction aria-label="New group">+</SidebarGroupAction>
							<SidebarGroupContent>
								<SidebarInput placeholder="Filter items" />
								<SidebarMenu>
									<SidebarMenuItem>
										<SidebarMenuButton
											isActive
											variant="outline"
											size="lg"
											tooltip="Open settings"
										>
											<span>Settings</span>
										</SidebarMenuButton>
										<SidebarMenuAction showOnHover aria-label="Pin item">
											!
										</SidebarMenuAction>
										<SidebarMenuBadge>7</SidebarMenuBadge>
									</SidebarMenuItem>
									<SidebarMenuSkeleton showIcon />
									<SidebarMenuSub>
										<SidebarMenuSubItem>
											<SidebarMenuSubButton isActive size="sm" href="#logs">
												<span>Logs</span>
											</SidebarMenuSubButton>
										</SidebarMenuSubItem>
									</SidebarMenuSub>
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>
					<SidebarSeparator />
					<SidebarFooter>Footer</SidebarFooter>
					<SidebarRail />
				</Sidebar>
				<SidebarInset>
					<SidebarTrigger />
					<section>Body</section>
				</SidebarInset>
			</SidebarProvider>,
		);

		expect(html).toContain('data-slot="sidebar-wrapper"');
		expect(html).toContain("shell");
		expect(html).toContain('data-state="collapsed"');
		expect(html).toContain('data-collapsible="icon"');
		expect(html).toContain('data-side="right"');
		expect(html).toContain('data-slot="sidebar-gap"');
		expect(html).toContain('data-slot="sidebar-container"');
		expect(html).toContain("Header");
		expect(html).toContain("Footer");
		expect(html).toContain('placeholder="Filter items"');
		expect(html).toContain('data-slot="tooltip-content"');
		expect(html).toContain(">Open settings<");
		expect(html).toContain('data-active="true"');
		expect(html).toContain('data-size="lg"');
		expect(html).toContain('aria-label="Pin item"');
		expect(html).toContain(">7<");
		expect(html).toContain('data-sidebar="menu-skeleton-icon"');
		expect(html).toContain("--skeleton-width:50%");
		expect(html).toContain('href="#logs"');
		expect(html).toContain(">Logs<");
		expect(html).toContain('aria-label="Toggle Sidebar"');
		expect(html).toContain(">Body<");
		expect(html).not.toContain('hidden=""');
	});

	it("renders a static sidebar when collapsible is disabled", () => {
		const html = renderToStaticMarkup(
			<SidebarProvider>
				<Sidebar collapsible="none" className="static-nav">
					<span>Static content</span>
				</Sidebar>
			</SidebarProvider>,
		);

		expect(html).toContain('data-slot="sidebar"');
		expect(html).toContain("static-nav");
		expect(html).toContain(">Static content<");
		expect(html).not.toContain('data-slot="sidebar-gap"');
	});

	it("renders the mobile sheet sidebar and hides tooltip content on mobile", () => {
		state.isMobile = true;

		const html = renderToStaticMarkup(
			<SidebarProvider defaultOpen={false}>
				<Sidebar side="left">
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton tooltip={{ children: "Mobile tooltip" }}>
								<span>Mobile item</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</Sidebar>
			</SidebarProvider>,
		);

		expect(html).toContain('data-slot="sheet"');
		expect(html).toContain('data-slot="sheet-content"');
		expect(html).toContain('data-mobile="true"');
		expect(html).toContain('data-side="left"');
		expect(html).toContain(">Sidebar<");
		expect(html).toContain(">Displays the mobile sidebar.<");
		expect(html).toContain('data-slot="tooltip-content"');
		expect(html).toContain('hidden=""');
		expect(html).toContain(">Mobile tooltip<");
	});

	it("renders slot-backed variants and omits tooltip wrappers when tooltip is absent", () => {
		const html = renderToStaticMarkup(
			<SidebarProvider defaultOpen>
				<Sidebar variant="inset" collapsible="offcanvas">
					<SidebarContent>
						<SidebarGroup>
							<SidebarGroupLabel asChild>
								<span>Projects</span>
							</SidebarGroupLabel>
							<SidebarGroupAction asChild aria-label="Create project">
								<a href="/projects/new">+</a>
							</SidebarGroupAction>
							<SidebarGroupContent>
								<SidebarMenu>
									<SidebarMenuItem>
										<SidebarMenuButton asChild size="sm">
											<a href="/projects/current">
												<span>Current project</span>
											</a>
										</SidebarMenuButton>
									</SidebarMenuItem>
									<SidebarMenuSub>
										<SidebarMenuSubItem>
											<SidebarMenuSubButton asChild size="md">
												<button type="button">
													<span>Inspect</span>
												</button>
											</SidebarMenuSubButton>
										</SidebarMenuSubItem>
									</SidebarMenuSub>
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</SidebarContent>
				</Sidebar>
			</SidebarProvider>,
		);

		expect(html).toContain(">Projects<");
		expect(html).toContain('aria-label="Create project"');
		expect(html).toContain('href="/projects/current"');
		expect(html).toContain('data-size="sm"');
		expect(html).toContain('data-size="md"');
		expect(html).toContain(">Inspect<");
		expect(html).not.toContain('data-slot="tooltip"');
	});

	it("throws when useSidebar is called outside the provider", () => {
		function OutsideConsumer() {
			useSidebar();
			return <div>unreachable</div>;
		}

		expect(() => renderToStaticMarkup(<OutsideConsumer />)).toThrow(
			"useSidebar must be used within a SidebarProvider.",
		);
	});

	it("registers the cmd/ctrl+b keyboard shortcut and removes it on cleanup", async () => {
		const addEventListener = vi.fn();
		const removeEventListener = vi.fn();
		let cleanup: (() => void) | undefined;

		globalThis.window = {
			addEventListener,
			removeEventListener,
		} as unknown as Window & typeof globalThis;
		globalThis.document = { cookie: "" } as Document;

		const onOpenChange = vi.fn();
		vi.resetModules();
		vi.doMock("react", async (importOriginal) => {
			const actual = await importOriginal<typeof import("react")>();
			return {
				...actual,
				useEffect: (effect: React.EffectCallback) => {
					const maybeCleanup = effect();
					cleanup =
						typeof maybeCleanup === "function" ? maybeCleanup : undefined;
				},
			};
		});

		try {
			const {
				SidebarProvider: DynamicSidebarProvider,
				SidebarTrigger: DynamicSidebarTrigger,
			} = await import("./sidebar");

			renderToStaticMarkup(
				<DynamicSidebarProvider open onOpenChange={onOpenChange}>
					<DynamicSidebarTrigger />
				</DynamicSidebarProvider>,
			);

			expect(addEventListener).toHaveBeenCalledTimes(1);
			expect(addEventListener).toHaveBeenCalledWith(
				"keydown",
				expect.any(Function),
			);

			const handler = addEventListener.mock.calls[0]?.[1] as
				| ((event: KeyboardEvent) => void)
				| undefined;
			expect(handler).toBeTypeOf("function");

			const preventDefault = vi.fn();
			handler?.({
				key: "b",
				metaKey: true,
				ctrlKey: false,
				preventDefault,
			} as unknown as KeyboardEvent);
			handler?.({
				key: "b",
				metaKey: false,
				ctrlKey: true,
				preventDefault,
			} as unknown as KeyboardEvent);
			handler?.({
				key: "x",
				metaKey: true,
				ctrlKey: false,
				preventDefault,
			} as unknown as KeyboardEvent);

			expect(preventDefault).toHaveBeenCalledTimes(2);
			expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
			expect(onOpenChange).toHaveBeenNthCalledWith(2, false);

			cleanup?.();

			expect(removeEventListener).toHaveBeenCalledTimes(1);
			expect(removeEventListener).toHaveBeenCalledWith("keydown", handler);
		} finally {
			vi.doUnmock("react");
		}
	});

	it("calls the passed click handler and toggles the sidebar from SidebarTrigger", () => {
		globalThis.document = { cookie: "" } as Document;

		const onOpenChange = vi.fn();
		const onClick = vi.fn();

		renderToStaticMarkup(
			<SidebarProvider open onOpenChange={onOpenChange}>
				<SidebarTrigger onClick={onClick} />
			</SidebarProvider>,
		);

		const buttonProps = state.lastButtonProps as
			| (React.ComponentProps<"button"> & Record<string, unknown>)
			| undefined;
		expect(buttonProps?.["data-sidebar"]).toBe("trigger");
		expect(buttonProps?.["data-slot"]).toBe("sidebar-trigger");

		state.lastButtonProps?.onClick?.({
			type: "click",
			defaultPrevented: false,
		} as React.MouseEvent<HTMLButtonElement>);

		expect(onClick).toHaveBeenCalledTimes(1);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
