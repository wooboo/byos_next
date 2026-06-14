import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

vi.mock("@/lib/auth/auth-client", () => ({
	authClient: {
		admin: {
			listUsers: vi.fn(async () => ({ data: { users: [] } })),
			createUser: vi.fn(),
			setRole: vi.fn(),
			banUser: vi.fn(),
			unbanUser: vi.fn(),
			removeUser: vi.fn(),
		},
	},
}));

vi.mock("@/components/common/page-template", () => ({
	PageTemplate: ({
		title,
		subtitle,
		left,
		children,
	}: {
		title: string;
		subtitle: string;
		left?: React.ReactNode;
		children: React.ReactNode;
	}) => (
		<div>
			<h1>{title}</h1>
			<p>{subtitle}</p>
			<div>{left}</div>
			{children}
		</div>
	),
}));

vi.mock("@/components/admin/admin-resource-table", () => ({
	AdminResourceTable: ({
		title,
		description,
		headers,
		loading,
		empty,
		loadingLabel,
		emptyLabel,
		children,
	}: {
		title: string;
		description: React.ReactNode;
		headers: string[];
		loading: boolean;
		empty: boolean;
		loadingLabel: string;
		emptyLabel: string;
		children: React.ReactNode;
	}) => (
		<div>
			<h2>{title}</h2>
			<div>{description}</div>
			<div>{headers.join("|")}</div>
			<div>{loading ? loadingLabel : empty ? emptyLabel : "loaded"}</div>
			{children}
		</div>
	),
	AdminRowActions: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuItem: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuSeparator: () => <hr />,
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		onClick,
	}: {
		children: React.ReactNode;
		onClick?: () => void;
	}) => (
		<button type="button" onClick={onClick}>
			{children}
		</button>
	),
}));

vi.mock("@/components/ui/badge", () => ({
	Badge: ({ children }: { children: React.ReactNode }) => (
		<span>{children}</span>
	),
}));

vi.mock("@/components/ui/dialog", () => ({
	Dialog: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogDescription: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogFooter: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogHeader: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DialogTitle: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/input", () => ({
	Input: () => <input />,
}));

vi.mock("@/components/ui/label", () => ({
	Label: ({ children }: { children: React.ReactNode }) => (
		<label>
			<input />
			{children}
		</label>
	),
}));

vi.mock("@/components/ui/select", () => ({
	Select: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectItem: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	SelectValue: () => <div>select-value</div>,
}));

vi.mock("@/components/ui/table", () => ({
	TableCell: ({ children }: { children: React.ReactNode }) => (
		<td>{children}</td>
	),
	TableRow: ({ children }: { children: React.ReactNode }) => (
		<tr>{children}</tr>
	),
}));

type ClientPageModule = typeof import("./client-page.tsx");

async function getClientPage() {
	vi.resetModules();
	return (await import("./client-page.tsx")).default;
}

async function getClientPageWithState(
	state: Array<{
		value: unknown;
		setter?: (value: unknown) => void;
	}>,
): Promise<ClientPageModule["default"]> {
	vi.resetModules();
	const entries = state;
	let callIndex = 0;

	vi.doMock("react", async (importOriginal) => {
		const actual = await importOriginal<typeof import("react")>();

		return {
			...actual,
			useCallback: (fn: () => Promise<void>) => fn,
			useEffect: () => undefined,
			useState: (initial: unknown) => {
				const entry = entries[callIndex++];
				if (!entry) {
					return [initial, vi.fn()] as const;
				}
				return [entry.value, entry.setter ?? vi.fn()] as const;
			},
		};
	});

	return (await import("./client-page.tsx")).default;
}

describe("Admin users client page", () => {
	it("renders the initial loading table state on SSR", async () => {
		const AdminUsersClientPage = await getClientPage();
		const html = renderToStaticMarkup(<AdminUsersClientPage />);

		assert.match(html, /User Management/);
		assert.match(html, /Manage users, roles, and permissions/);
		assert.match(html, /Loading users\.\.\./);
		assert.match(html, /Add User/);
		assert.match(html, /Name\|Email\|Role\|Status\|Created/);
	});

	it("renders populated rows and both admin dialogs from mocked client state", async () => {
		const AdminUsersClientPage = await getClientPageWithState([
			{
				value: [
					{
						id: "user-admin",
						name: "Admin User",
						email: "admin@example.com",
						role: "admin",
						banned: true,
						createdAt: "2024-01-02T00:00:00.000Z",
						emailVerified: true,
					},
					{
						id: "user-member",
						name: "Member User",
						email: "member@example.com",
						role: "user",
						banned: false,
						createdAt: "2024-03-04T00:00:00.000Z",
						emailVerified: false,
					},
				],
			},
			{ value: false },
			{ value: true },
			{ value: true },
			{
				value: {
					id: "user-admin",
					name: "Admin User",
					email: "admin@example.com",
					role: "admin",
					banned: true,
					createdAt: "2024-01-02T00:00:00.000Z",
					emailVerified: true,
				},
			},
			{
				value: {
					name: "",
					email: "",
					password: "",
					role: "user",
				},
			},
		]);

		const html = renderToStaticMarkup(<AdminUsersClientPage />);

		assert.match(html, /2 users registered/);
		assert.match(html, /Admin User/);
		assert.match(html, /Member User/);
		assert.match(html, /Remove admin/);
		assert.match(html, /Make admin/);
		assert.match(html, /Unban user/);
		assert.match(html, /Ban user/);
		assert.match(html, /Create New User/);
		assert.match(html, /Delete User/);
		assert.match(html, /delete Admin User/i);
	});
});
