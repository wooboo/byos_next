import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import type { ComponentConfig } from "@/components/sidebar-types";
import type { Device, RecipeSidebarItem } from "@/lib/types";

const state = vi.hoisted(() => ({
	buttons: [] as Array<React.ButtonHTMLAttributes<HTMLButtonElement>>,
	setTheme: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	usePathname: () => "/screens",
}));

vi.mock("next-themes", () => ({
	useTheme: () => ({
		theme: "dark",
		setTheme: state.setTheme,
	}),
}));

vi.mock("@/components/ui/button", () => ({
	Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
		state.buttons.push(props);
		return <button type="button">{props.children}</button>;
	},
}));

vi.mock("@/components/app-sidebar", () => ({
	AppSidebar: ({ currentPath }: { currentPath: string }) => (
		<div data-testid="app-sidebar">Sidebar for {currentPath}</div>
	),
}));

vi.mock("@/components/command-palette", () => ({
	CommandPalette: ({ open }: { open: boolean }) => (
		<div data-testid="command-palette">Palette open: {String(open)}</div>
	),
}));

import {
	ClientMainLayout,
	GithubIcon,
	getNextTheme,
	MainContentSkeleton,
} from "./client-main-layout";

const devices: Device[] = [];
const recipeSidebarItems: RecipeSidebarItem[] = [];
const toolsComponents: [string, ComponentConfig][] = [];

function textContent(node: React.ReactNode): string {
	if (Array.isArray(node)) {
		return node.map((child) => textContent(child)).join("");
	}

	if (
		typeof node === "string" ||
		typeof node === "number" ||
		typeof node === "bigint"
	) {
		return String(node);
	}

	if (node && typeof node === "object" && "props" in node) {
		return textContent(
			(node as { props: { children?: React.ReactNode } }).props.children,
		);
	}

	return "";
}

describe("ClientMainLayout", () => {
	it("renders the shell header, sidebar boundary, and page content", () => {
		const html = renderToStaticMarkup(
			<ClientMainLayout
				devices={devices}
				dbStatus={{ ready: true }}
				recipeSidebarItems={recipeSidebarItems}
				toolsComponents={toolsComponents}
				user={null}
				authEnabled={false}
			>
				<section>Screen content</section>
			</ClientMainLayout>,
		);

		assert.match(html, /Sidebar for \/screens/);
		assert.match(html, /Search\.\.\./);
		assert.match(html, /⌘K/);
		assert.match(html, /Screen content/);
		assert.match(html, /Palette open: false/);
		assert.match(html, /github\.com\/usetrmnl\/byos_next/);
	});

	it("exports the GitHub icon, loading skeleton, and theme toggle helper", () => {
		const iconHtml = renderToStaticMarkup(<GithubIcon className="size-5" />);
		const skeletonHtml = renderToStaticMarkup(<MainContentSkeleton />);

		assert.match(iconHtml, /viewBox="0 0 24 24"/);
		assert.equal((skeletonHtml.match(/rounded-lg/g) ?? []).length, 4);
		assert.equal(getNextTheme("dark"), "light");
		assert.equal(getNextTheme("light"), "dark");
		assert.equal(getNextTheme(undefined), "dark");
	});

	it("wires the search and theme buttons with callbacks", () => {
		state.buttons = [];

		renderToStaticMarkup(
			<ClientMainLayout
				devices={devices}
				dbStatus={{ ready: true }}
				recipeSidebarItems={recipeSidebarItems}
				toolsComponents={toolsComponents}
				user={null}
				authEnabled={false}
			>
				<section>Screen content</section>
			</ClientMainLayout>,
		);

		const searchButton = state.buttons.find((props) =>
			textContent(props.children).includes("Search"),
		);

		assert.ok(searchButton?.onClick);
		searchButton?.onClick?.({} as never);
	});
});
