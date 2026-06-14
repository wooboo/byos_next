import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	isMobile: false,
	push: vi.fn(),
	refresh: vi.fn(),
	signOutItem: undefined as (() => Promise<void>) | undefined,
	menuSide: undefined as string | undefined,
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: state.push,
		refresh: state.refresh,
	}),
}));

vi.mock("@/components/ui/sidebar", () => ({
	SidebarMenu: ({ children }: { children: React.ReactNode }) => (
		<div data-sidebar-menu>{children}</div>
	),
	SidebarMenuButton: ({ children }: { children: React.ReactNode }) => (
		<button type="button">{children}</button>
	),
	SidebarMenuItem: ({ children }: { children: React.ReactNode }) => (
		<div data-sidebar-item>{children}</div>
	),
	useSidebar: () => ({ isMobile: state.isMobile }),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuContent: ({
		children,
		side,
	}: {
		children: React.ReactNode;
		side?: string;
	}) => {
		state.menuSide = side;
		return <div>{children}</div>;
	},
	DropdownMenuGroup: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuItem: ({
		children,
		onClick,
	}: {
		children: React.ReactNode;
		onClick?: () => void;
	}) => {
		if (onClick) {
			state.signOutItem = onClick as () => Promise<void>;
		}
		return <div>{children}</div>;
	},
	DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuSeparator: () => <hr />,
}));

vi.mock("@/lib/auth/auth-client", () => ({
	authClient: {
		signOut: vi.fn(async () => undefined),
	},
}));

import { getUserInitials, NavUser } from "./nav-user";

describe("NavUser", () => {
	it("renders the signed-in user summary and admin navigation links", () => {
		const html = renderToStaticMarkup(
			<NavUser
				user={{
					name: "Ada Lovelace",
					email: "ada@example.com",
					role: "admin",
					image: null,
				}}
			/>,
		);

		assert.match(html, /Ada Lovelace/);
		assert.match(html, /ada@example\.com/);
		assert.match(html, />AL</);
		assert.match(html, /Manage users/);
		assert.match(html, /Manage devices/);
		assert.match(html, /Report an issue/);
		assert.match(html, /Send feedback/);
		assert.match(html, /BYOS%20v0\.2\.\d+%20Feedback/);
		assert.match(html, /Sign out/);
	});

	it("derives initials for full names, single names, and email fallbacks", () => {
		assert.equal(
			getUserInitials({
				name: "Ada Lovelace",
				email: "ada@example.com",
			}),
			"AL",
		);
		assert.equal(
			getUserInitials({
				name: "Ada",
				email: "ada@example.com",
			}),
			"A",
		);
		assert.equal(
			getUserInitials({
				name: "",
				email: "ada@example.com",
			}),
			"A",
		);
		assert.equal(
			getUserInitials({
				name: "",
				email: "",
			}),
			"U",
		);
	});

	it("omits admin links for non-admin users and signs out through the router", async () => {
		state.isMobile = true;
		state.push.mockReset();
		state.refresh.mockReset();
		const { authClient } = await import("@/lib/auth/auth-client");

		const html = renderToStaticMarkup(
			<NavUser
				user={{
					name: "Grace",
					email: "grace@example.com",
					role: "viewer",
					image: "https://example.com/avatar.png",
				}}
			/>,
		);

		assert.doesNotMatch(html, /Manage users/);
		assert.doesNotMatch(html, /Manage devices/);
		assert.match(html, />G</);
		assert.equal(state.menuSide, "bottom");

		await state.signOutItem?.();

		assert.equal(vi.mocked(authClient.signOut).mock.calls.length, 1);
		assert.deepEqual(state.push.mock.calls, [["/sign-in"]]);
		assert.equal(state.refresh.mock.calls.length, 1);
		state.isMobile = false;
	});
});
