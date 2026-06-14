import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, it, vi } from "vitest";

type StateEntry = {
	value: unknown;
	setter?: ReturnType<typeof vi.fn>;
};

type AdminUserApiRecord = {
	id: string;
	name: string | null;
	email: string | null;
	role: string | null;
	banned?: boolean | number | null;
	banReason?: string | null;
	banExpires?: string | Date | null;
	createdAt?: string | Date | null;
	emailVerified?: boolean | number | null;
};

type CapturedAction = {
	label: string;
	onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

type CapturedInput = {
	id?: string;
	onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

const pageState = vi.hoisted(() => ({
	buttons: [] as CapturedAction[],
	menuItems: [] as CapturedAction[],
	inputs: [] as CapturedInput[],
	selectOnValueChange: undefined as undefined | ((value: string) => void),
}));

const toastState = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
}));

const authState = vi.hoisted(() => ({
	listUsers: vi.fn(
		async (): Promise<{ data: { users: AdminUserApiRecord[] } }> => ({
			data: { users: [] },
		}),
	),
	createUser: vi.fn(),
	setRole: vi.fn(),
	banUser: vi.fn(),
	unbanUser: vi.fn(),
	removeUser: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: toastState,
}));

vi.mock("@/lib/auth/auth-client", () => ({
	authClient: {
		admin: authState,
	},
}));

vi.mock("@/components/common/page-template", () => ({
	PageTemplate: ({
		children,
		title,
		subtitle,
		left,
	}: {
		children: React.ReactNode;
		title: React.ReactNode;
		subtitle: React.ReactNode;
		left?: React.ReactNode;
	}) => (
		<div>
			<div>{title}</div>
			<div>{subtitle}</div>
			<div>{left}</div>
			{children}
		</div>
	),
}));

vi.mock("@/components/admin/admin-resource-table", () => ({
	AdminResourceTable: ({
		children,
		description,
	}: {
		children: React.ReactNode;
		description: React.ReactNode;
	}) => (
		<div>
			<div>{description}</div>
			<table>{children}</table>
		</div>
	),
	AdminRowActions: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuItem: ({
		children,
		onClick,
	}: {
		children: React.ReactNode;
		onClick?: React.MouseEventHandler<HTMLButtonElement>;
	}) => {
		const label = React.Children.toArray(children)
			.filter((child) => typeof child === "string")
			.join(" ")
			.replace(/\s+/g, " ")
			.trim();
		pageState.menuItems.push({ label, onClick });
		return (
			<button type="button" onClick={onClick}>
				{children}
			</button>
		);
	},
	DropdownMenuSeparator: () => <hr />,
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		onClick,
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
		const label = React.Children.toArray(children)
			.filter((child) => typeof child === "string")
			.join(" ")
			.replace(/\s+/g, " ")
			.trim();
		pageState.buttons.push({ label, onClick });
		return (
			<button type="button" onClick={onClick}>
				{children}
			</button>
		);
	},
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
	Input: ({
		id,
		onChange,
	}: {
		id?: string;
		onChange?: React.ChangeEventHandler<HTMLInputElement>;
	}) => {
		pageState.inputs.push({ id, onChange });
		return <input />;
	},
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
	Select: ({
		children,
		onValueChange,
	}: {
		children: React.ReactNode;
		onValueChange?: (value: string) => void;
	}) => {
		pageState.selectOnValueChange = onValueChange;
		return <div>{children}</div>;
	},
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

async function loadClientPage(stateEntries: StateEntry[], runEffects = false) {
	vi.resetModules();
	const entries = stateEntries;
	let callIndex = 0;

	vi.doMock("react", async (importOriginal) => {
		const actual = await importOriginal<typeof import("react")>();
		return {
			...actual,
			useCallback: (fn: (...args: unknown[]) => unknown) => fn,
			useEffect: (effect: React.EffectCallback) => {
				if (runEffects) {
					effect();
				}
			},
			useState: (initial: unknown) => {
				const resolvedInitial =
					typeof initial === "function"
						? (initial as () => unknown)()
						: initial;
				const entry = entries[callIndex++];
				if (!entry) {
					return [resolvedInitial, vi.fn()] as const;
				}
				return [entry.value, entry.setter ?? vi.fn()] as const;
			},
		};
	});

	return (await import("./client-page.tsx")).default;
}

function findButton(label: string) {
	return pageState.buttons.find((button) => button.label === label);
}

function findMenuItem(label: string) {
	return pageState.menuItems.find((item) => item.label === label);
}

function findInput(id: string) {
	return pageState.inputs.find((input) => input.id === id);
}

async function triggerAction(action: CapturedAction | undefined) {
	await action?.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
}

async function flushAsyncWork() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
	vi.clearAllMocks();
	pageState.buttons = [];
	pageState.menuItems = [];
	pageState.inputs = [];
	pageState.selectOnValueChange = undefined;
});

describe("Admin users extra coverage", () => {
	it("normalizes fetched users from auth admin APIs", async () => {
		const setUsers = vi.fn();
		const setLoading = vi.fn();
		const listedUsers: AdminUserApiRecord[] = [
			{
				id: "user-1",
				name: null,
				email: null,
				role: null,
				banned: 1,
				banReason: null,
				banExpires: new Date("2024-05-06T07:08:09.000Z"),
				createdAt: new Date("2024-01-02T03:04:05.000Z"),
				emailVerified: 0,
			},
		];
		authState.listUsers.mockResolvedValue({
			data: {
				users: listedUsers,
			},
		});

		const AdminUsersClientPage = await loadClientPage(
			[
				{ value: [] as unknown[], setter: setUsers },
				{ value: true, setter: setLoading },
				{ value: false },
				{ value: false },
				{ value: null },
				{
					value: {
						name: "",
						email: "",
						password: "",
						role: "user",
					},
				},
			],
			true,
		);

		renderToStaticMarkup(<AdminUsersClientPage />);
		await flushAsyncWork();

		assert.deepEqual(setUsers.mock.calls[0]?.[0], [
			{
				id: "user-1",
				name: "",
				email: "",
				role: "user",
				banned: true,
				banReason: undefined,
				banExpires: "2024-05-06T07:08:09.000Z",
				createdAt: "2024-01-02T03:04:05.000Z",
				emailVerified: false,
			},
		]);
		assert.deepEqual(
			setLoading.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});

	it("creates a user and resets dialog state on success", async () => {
		const setCreateDialogOpen = vi.fn();
		const setNewUser = vi.fn();
		authState.createUser.mockResolvedValue({ error: null });
		authState.listUsers.mockResolvedValue({ data: { users: [] } });

		const AdminUsersClientPage = await loadClientPage([
			{ value: [] as unknown[] },
			{ value: false },
			{ value: true, setter: setCreateDialogOpen },
			{ value: false },
			{ value: null },
			{
				value: {
					name: "Dev User",
					email: "dev@example.com",
					password: "password123",
					role: "admin",
				},
				setter: setNewUser,
			},
		]);

		renderToStaticMarkup(<AdminUsersClientPage />);
		await triggerAction(findButton("Create User"));
		await flushAsyncWork();

		assert.deepEqual(authState.createUser.mock.calls[0], [
			{
				name: "Dev User",
				email: "dev@example.com",
				password: "password123",
				role: "admin",
			},
		]);
		assert.equal(
			toastState.success.mock.calls[0]?.[0],
			"User created successfully",
		);
		assert.equal(setCreateDialogOpen.mock.calls[0]?.[0], false);
		assert.deepEqual(setNewUser.mock.calls[0]?.[0], {
			name: "",
			email: "",
			password: "",
			role: "user",
		});
	});

	it("updates role and ban state from row actions", async () => {
		authState.setRole.mockResolvedValue({ error: null });
		authState.banUser.mockResolvedValue({ error: null });
		authState.unbanUser.mockResolvedValue({ error: null });
		authState.listUsers.mockResolvedValue({ data: { users: [] } });

		const AdminUsersClientPage = await loadClientPage([
			{
				value: [
					{
						id: "user-1",
						name: "Member User",
						email: "member@example.com",
						role: "user",
						banned: false,
						createdAt: "2024-01-01T00:00:00.000Z",
						emailVerified: true,
					},
					{
						id: "user-2",
						name: "Admin User",
						email: "admin@example.com",
						role: "admin",
						banned: true,
						createdAt: "2024-01-01T00:00:00.000Z",
						emailVerified: true,
					},
				],
			},
			{ value: false },
			{ value: false },
			{ value: false },
			{ value: null },
			{
				value: {
					name: "",
					email: "",
					password: "",
					role: "user",
				},
			},
		]);

		renderToStaticMarkup(<AdminUsersClientPage />);
		await triggerAction(findMenuItem("Make admin"));
		await triggerAction(findMenuItem("Ban user"));
		await triggerAction(findMenuItem("Remove admin"));
		await triggerAction(findMenuItem("Unban user"));

		assert.deepEqual(authState.setRole.mock.calls[0], [
			{ userId: "user-1", role: "admin" },
		]);
		assert.deepEqual(authState.banUser.mock.calls[0], [
			{ userId: "user-1", banReason: "Banned by admin" },
		]);
		assert.deepEqual(authState.setRole.mock.calls[1], [
			{ userId: "user-2", role: "user" },
		]);
		assert.deepEqual(authState.unbanUser.mock.calls[0], [{ userId: "user-2" }]);
		assert.equal(
			toastState.success.mock.calls[0]?.[0],
			"Role updated to admin",
		);
		assert.equal(toastState.success.mock.calls[1]?.[0], "User banned");
		assert.equal(toastState.success.mock.calls[2]?.[0], "Role updated to user");
		assert.equal(toastState.success.mock.calls[3]?.[0], "User unbanned");
	});

	it("deletes the selected user from the dialog", async () => {
		const setDeleteDialogOpen = vi.fn();
		const setSelectedUser = vi.fn();
		authState.removeUser.mockResolvedValue({ error: null });
		authState.listUsers.mockResolvedValue({ data: { users: [] } });

		const selectedUser = {
			id: "user-1",
			name: "Dev User",
			email: "dev@example.com",
			role: "user",
			banned: false,
			createdAt: "2024-01-01T00:00:00.000Z",
			emailVerified: true,
		};

		const AdminUsersClientPage = await loadClientPage([
			{ value: [selectedUser] },
			{ value: false },
			{ value: false },
			{ value: true, setter: setDeleteDialogOpen },
			{ value: selectedUser, setter: setSelectedUser },
			{
				value: {
					name: "",
					email: "",
					password: "",
					role: "user",
				},
			},
		]);

		renderToStaticMarkup(<AdminUsersClientPage />);
		await triggerAction(findButton("Delete User"));
		await flushAsyncWork();

		assert.deepEqual(authState.removeUser.mock.calls[0], [
			{ userId: "user-1" },
		]);
		assert.equal(toastState.success.mock.calls[0]?.[0], "User deleted");
		assert.equal(setDeleteDialogOpen.mock.calls[0]?.[0], false);
		assert.equal(setSelectedUser.mock.calls[0]?.[0], null);
	});

	it("shows an error when fetching users fails", async () => {
		const setUsers = vi.fn();
		const setLoading = vi.fn();
		authState.listUsers.mockRejectedValue(new Error("network"));

		const AdminUsersClientPage = await loadClientPage(
			[
				{ value: [] as unknown[], setter: setUsers },
				{ value: true, setter: setLoading },
				{ value: false },
				{ value: false },
				{ value: null },
				{
					value: {
						name: "",
						email: "",
						password: "",
						role: "user",
					},
				},
			],
			true,
		);

		renderToStaticMarkup(<AdminUsersClientPage />);
		await flushAsyncWork();

		assert.equal(toastState.error.mock.calls[0]?.[0], "Failed to fetch users");
		assert.deepEqual(
			setLoading.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});

	it("surfaces create-user API errors without resetting form state", async () => {
		const setCreateDialogOpen = vi.fn();
		const setNewUser = vi.fn();
		authState.createUser.mockResolvedValue({
			error: { message: "Email already exists" },
		});

		const AdminUsersClientPage = await loadClientPage([
			{ value: [] as unknown[] },
			{ value: false },
			{ value: true, setter: setCreateDialogOpen },
			{ value: false },
			{ value: null },
			{
				value: {
					name: "Dev User",
					email: "dev@example.com",
					password: "password123",
					role: "admin",
				},
				setter: setNewUser,
			},
		]);

		renderToStaticMarkup(<AdminUsersClientPage />);
		await triggerAction(findButton("Create User"));
		await flushAsyncWork();

		assert.equal(toastState.error.mock.calls[0]?.[0], "Email already exists");
		assert.equal(setCreateDialogOpen.mock.calls.length, 0);
		assert.equal(setNewUser.mock.calls.length, 0);
	});

	it("handles create-user transport failures and dialog-opening callbacks", async () => {
		const setCreateDialogOpen = vi.fn();
		authState.createUser.mockRejectedValue(new Error("down"));

		const AdminUsersClientPage = await loadClientPage([
			{ value: [] as unknown[] },
			{ value: false },
			{ value: false, setter: setCreateDialogOpen },
			{ value: false },
			{ value: null },
			{
				value: {
					name: "Dev User",
					email: "dev@example.com",
					password: "password123",
					role: "user",
				},
			},
		]);

		renderToStaticMarkup(<AdminUsersClientPage />);
		await triggerAction(findButton("Add User"));
		await triggerAction(findButton("Create User"));
		await flushAsyncWork();

		assert.equal(setCreateDialogOpen.mock.calls[0]?.[0], true);
		assert.equal(toastState.error.mock.calls[0]?.[0], "Failed to create user");
	});

	it("updates draft user fields through form handlers", async () => {
		const setNewUser = vi.fn();
		const AdminUsersClientPage = await loadClientPage([
			{ value: [] as unknown[] },
			{ value: false },
			{ value: true },
			{ value: false },
			{ value: null },
			{
				value: {
					name: "",
					email: "",
					password: "",
					role: "user",
				},
				setter: setNewUser,
			},
		]);

		renderToStaticMarkup(<AdminUsersClientPage />);
		findInput("name")?.onChange?.({
			target: { value: "Jane" },
		} as React.ChangeEvent<HTMLInputElement>);
		findInput("email")?.onChange?.({
			target: { value: "jane@example.com" },
		} as React.ChangeEvent<HTMLInputElement>);
		findInput("password")?.onChange?.({
			target: { value: "secret123" },
		} as React.ChangeEvent<HTMLInputElement>);
		pageState.selectOnValueChange?.("admin");

		assert.deepEqual(setNewUser.mock.calls[0]?.[0], {
			name: "Jane",
			email: "",
			password: "",
			role: "user",
		});
		assert.deepEqual(setNewUser.mock.calls[1]?.[0], {
			name: "",
			email: "jane@example.com",
			password: "",
			role: "user",
		});
		assert.deepEqual(setNewUser.mock.calls[2]?.[0], {
			name: "",
			email: "",
			password: "secret123",
			role: "user",
		});
		assert.deepEqual(setNewUser.mock.calls[3]?.[0], {
			name: "",
			email: "",
			password: "",
			role: "admin",
		});
	});

	it("surfaces role, ban, unban, and delete failures", async () => {
		authState.setRole.mockResolvedValue({ error: { message: "nope" } });
		authState.banUser.mockRejectedValue(new Error("down"));
		authState.unbanUser.mockResolvedValue({ error: { message: "locked" } });
		authState.removeUser.mockRejectedValue(new Error("down"));

		const selectedUser = {
			id: "user-1",
			name: "Dev User",
			email: "dev@example.com",
			role: "user",
			banned: false,
			createdAt: "2024-01-01T00:00:00.000Z",
			emailVerified: true,
		};

		const AdminUsersClientPage = await loadClientPage([
			{
				value: [
					selectedUser,
					{
						...selectedUser,
						id: "user-2",
						role: "admin",
						banned: true,
					},
				],
			},
			{ value: false },
			{ value: false },
			{ value: true },
			{ value: selectedUser },
			{
				value: {
					name: "",
					email: "",
					password: "",
					role: "user",
				},
			},
		]);

		renderToStaticMarkup(<AdminUsersClientPage />);
		await triggerAction(findMenuItem("Make admin"));
		await triggerAction(findMenuItem("Ban user"));
		await triggerAction(findMenuItem("Unban user"));
		await triggerAction(findButton("Delete User"));
		await flushAsyncWork();

		assert.deepEqual(
			toastState.error.mock.calls.map((call) => call[0]),
			["nope", "Failed to ban user", "locked", "Failed to delete user"],
		);
	});
});
