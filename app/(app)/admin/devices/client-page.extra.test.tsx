import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, it, vi } from "vitest";
import type { AdminDevice, AdminUser } from "@/app/actions/admin-devices";

type StateEntry = {
	value: unknown;
	setter?: ReturnType<typeof vi.fn>;
};

type CapturedButton = {
	label: string;
	onClick?: React.MouseEventHandler<HTMLButtonElement>;
	disabled?: boolean;
};

type CapturedMenuItem = {
	label: string;
	onClick?: () => void | Promise<void>;
};

const pageState = vi.hoisted(() => ({
	buttons: [] as CapturedButton[],
	menuItems: [] as CapturedMenuItem[],
}));

const toastState = vi.hoisted(() => ({
	success: vi.fn(),
	error: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: toastState,
}));

vi.mock("@/app/actions/admin-devices", () => ({
	assignDeviceToUser: vi.fn(),
	deleteDeviceAdmin: vi.fn(),
	fetchAllDevicesAdmin: vi.fn(async () => []),
	fetchAllUsersForAdmin: vi.fn(async () => []),
	unassignDevice: vi.fn(),
}));

vi.mock("@/app/actions/admin-maintenance", () => ({
	deleteAllDeviceLogs: vi.fn(),
	deleteAllSystemLogs: vi.fn(),
}));

vi.mock("@/components/common/page-template", () => ({
	PageTemplate: ({
		children,
		left,
	}: {
		children: React.ReactNode;
		left?: React.ReactNode;
	}) => (
		<div>
			<div>{left}</div>
			{children}
		</div>
	),
}));

vi.mock("@/components/admin/admin-resource-table", () => ({
	AdminResourceTable: ({
		description,
		children,
	}: {
		description: React.ReactNode;
		children: React.ReactNode;
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
		onClick?: () => void | Promise<void>;
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
		disabled,
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
		const label = React.Children.toArray(children)
			.filter((child) => typeof child === "string")
			.join(" ")
			.replace(/\s+/g, " ")
			.trim();
		pageState.buttons.push({ label, onClick, disabled });
		return (
			<button type="button" onClick={onClick} disabled={disabled}>
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

vi.mock("@/components/ui/card", () => ({
	Card: ({ children }: { children: React.ReactNode }) => (
		<section>{children}</section>
	),
	CardContent: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	CardDescription: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	CardHeader: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	CardTitle: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
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
	SelectValue: ({ placeholder }: { placeholder?: string }) => (
		<div>{placeholder ?? ""}</div>
	),
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

function buildDevice(overrides: Partial<AdminDevice> = {}): AdminDevice {
	return {
		id: 1,
		name: "Kitchen panel",
		friendly_id: "ABC123",
		api_key: "ABCD1234EFGH5678",
		mac_address: "AA:BB:CC:DD:EE:FF",
		user_id: null,
		user_name: null,
		user_email: null,
		created_at: "2024-01-01T00:00:00.000Z",
		updated_at: "2024-01-02T00:00:00.000Z",
		...overrides,
	};
}

function buildUser(overrides: Partial<AdminUser> = {}): AdminUser {
	return {
		id: "user-1",
		name: "Admin User",
		email: "admin@example.com",
		...overrides,
	};
}

function findButton(label: string) {
	return pageState.buttons.find((button) => button.label === label);
}

function findMenuItem(label: string) {
	return pageState.menuItems.find((item) => item.label === label);
}

afterEach(() => {
	pageState.buttons = [];
	pageState.menuItems = [];
	toastState.success.mockClear();
	toastState.error.mockClear();
	vi.unstubAllGlobals();
});

async function flushAsyncWork() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("Admin devices extra coverage", () => {
	it("renders assigned and unassigned devices with masked keys and dialogs", async () => {
		const AdminDevicesClientPage = await loadClientPage([
			{
				value: [
					buildDevice({
						user_id: "user-1",
						user_name: "Admin User",
						user_email: "admin@example.com",
					}),
					buildDevice({
						id: 2,
						name: "Hallway panel",
						api_key: "SHORTKEY",
					}),
				],
			},
			{ value: [buildUser()] },
			{ value: false },
			{ value: true },
			{ value: true },
			{ value: buildDevice({ name: "Kitchen panel" }) },
			{ value: "user-1" },
		]);

		const html = renderToStaticMarkup(<AdminDevicesClientPage />);

		assert.match(html, /2 devices registered/);
		assert.match(html, /ABCD\.\.\.5678/);
		assert.match(html, /\*\*\*\*/);
		assert.match(html, /Unassigned/);
		assert.match(html, /Assign Device to User/);
		assert.match(html, /Delete Device/);
		assert.match(html, /admin@example.com/);
	});

	it("assigns a selected device and refreshes data", async () => {
		const setAssignDialogOpen = vi.fn();
		const setSelectedDevice = vi.fn();
		const setSelectedUserId = vi.fn();
		const assignDeviceToUser = vi.mocked(
			(await import("@/app/actions/admin-devices")).assignDeviceToUser,
		);
		const fetchAllDevicesAdmin = vi.mocked(
			(await import("@/app/actions/admin-devices")).fetchAllDevicesAdmin,
		);
		const fetchAllUsersForAdmin = vi.mocked(
			(await import("@/app/actions/admin-devices")).fetchAllUsersForAdmin,
		);
		assignDeviceToUser.mockResolvedValue({ success: true });
		fetchAllDevicesAdmin.mockResolvedValue([buildDevice()]);
		fetchAllUsersForAdmin.mockResolvedValue([buildUser()]);

		const AdminDevicesClientPage = await loadClientPage([
			{ value: [buildDevice()] },
			{ value: [buildUser()] },
			{ value: false },
			{ value: true, setter: setAssignDialogOpen },
			{ value: false },
			{ value: buildDevice(), setter: setSelectedDevice },
			{ value: "user-1", setter: setSelectedUserId },
		]);

		renderToStaticMarkup(<AdminDevicesClientPage />);
		findButton("Assign")?.onClick?.({} as React.MouseEvent<HTMLButtonElement>);
		await flushAsyncWork();

		assert.deepEqual(assignDeviceToUser.mock.calls[0], [1, "user-1"]);
		assert.equal(toastState.success.mock.calls[0]?.[0], "Device assigned");
		assert.equal(setAssignDialogOpen.mock.calls[0]?.[0], false);
		assert.equal(setSelectedDevice.mock.calls[0]?.[0], null);
		assert.equal(setSelectedUserId.mock.calls[0]?.[0], "");
		assert.equal(fetchAllDevicesAdmin.mock.calls.length, 1);
		assert.equal(fetchAllUsersForAdmin.mock.calls.length, 1);
	});

	it("deletes all system logs after confirmation", async () => {
		const deleteAllSystemLogs = vi.mocked(
			(await import("@/app/actions/admin-maintenance")).deleteAllSystemLogs,
		);
		deleteAllSystemLogs.mockResolvedValue({ success: true, count: 7 });
		vi.stubGlobal(
			"confirm",
			vi.fn(() => true),
		);

		const AdminDevicesClientPage = await loadClientPage([
			{ value: [] },
			{ value: [] },
			{ value: false },
			{ value: false },
			{ value: false },
			{ value: null },
			{ value: "" },
		]);

		renderToStaticMarkup(<AdminDevicesClientPage />);
		findButton("Delete system logs")?.onClick?.(
			{} as React.MouseEvent<HTMLButtonElement>,
		);
		await flushAsyncWork();

		assert.equal(deleteAllSystemLogs.mock.calls.length, 1);
		assert.equal(
			toastState.success.mock.calls[0]?.[0],
			"Deleted 7 system logs",
		);
	});

	it("does not delete device logs when confirmation is rejected", async () => {
		const deleteAllDeviceLogs = vi.mocked(
			(await import("@/app/actions/admin-maintenance")).deleteAllDeviceLogs,
		);
		vi.stubGlobal(
			"confirm",
			vi.fn(() => false),
		);

		const AdminDevicesClientPage = await loadClientPage([
			{ value: [] },
			{ value: [] },
			{ value: false },
			{ value: false },
			{ value: false },
			{ value: null },
			{ value: "" },
		]);

		renderToStaticMarkup(<AdminDevicesClientPage />);
		findButton("Delete device logs")?.onClick?.(
			{} as React.MouseEvent<HTMLButtonElement>,
		);
		await flushAsyncWork();

		assert.equal(deleteAllDeviceLogs.mock.calls.length, 0);
		assert.equal(toastState.success.mock.calls.length, 0);
		assert.equal(toastState.error.mock.calls.length, 0);
	});

	it("shows assignment failures without mutating dialog state", async () => {
		const assignDeviceToUser = vi.mocked(
			(await import("@/app/actions/admin-devices")).assignDeviceToUser,
		);
		assignDeviceToUser.mockResolvedValue({
			success: false,
			error: "user locked",
		});

		const AdminDevicesClientPage = await loadClientPage(
			[
				{ value: [buildDevice()] },
				{ value: [buildUser()] },
				{ value: true },
				{ value: true },
				{ value: false },
				{ value: buildDevice() },
				{ value: "user-1" },
			],
			true,
		);

		renderToStaticMarkup(<AdminDevicesClientPage />);
		await findButton("Assign")?.onClick?.(
			{} as React.MouseEvent<HTMLButtonElement>,
		);
		await flushAsyncWork();

		assert.equal(toastState.error.mock.calls[0]?.[0], "user locked");
	});

	it("handles unassign and delete row actions including failure paths", async () => {
		const setSelectedDevice = vi.fn();
		const setDeleteDialogOpen = vi.fn();
		const unassignDevice = vi.mocked(
			(await import("@/app/actions/admin-devices")).unassignDevice,
		);
		const deleteDeviceAdmin = vi.mocked(
			(await import("@/app/actions/admin-devices")).deleteDeviceAdmin,
		);
		unassignDevice.mockResolvedValue({ success: false, error: "busy" });
		deleteDeviceAdmin.mockResolvedValue({ success: false, error: "protected" });

		const assignedDevice = buildDevice({
			user_id: "user-1",
			user_name: "Admin User",
			user_email: "admin@example.com",
		});
		const AdminDevicesClientPage = await loadClientPage([
			{ value: [assignedDevice] },
			{ value: [buildUser()] },
			{ value: false },
			{ value: false },
			{ value: true, setter: setDeleteDialogOpen },
			{ value: assignedDevice, setter: setSelectedDevice },
			{ value: "user-1" },
		]);

		renderToStaticMarkup(<AdminDevicesClientPage />);
		await findMenuItem("Assign to user")?.onClick?.();
		await findMenuItem("Unassign")?.onClick?.();
		await findMenuItem("Delete device")?.onClick?.();
		await findButton("Delete Device")?.onClick?.(
			{} as React.MouseEvent<HTMLButtonElement>,
		);
		await flushAsyncWork();

		assert.deepEqual(setSelectedDevice.mock.calls[0]?.[0], assignedDevice);
		assert.equal(setDeleteDialogOpen.mock.calls[0]?.[0], true);
		assert.equal(toastState.error.mock.calls[0]?.[0], "busy");
		assert.equal(toastState.error.mock.calls[1]?.[0], "protected");
	});

	it("shows log-deletion failures and defaults missing counts to zero", async () => {
		const deleteAllDeviceLogs = vi.mocked(
			(await import("@/app/actions/admin-maintenance")).deleteAllDeviceLogs,
		);
		const deleteAllSystemLogs = vi.mocked(
			(await import("@/app/actions/admin-maintenance")).deleteAllSystemLogs,
		);
		deleteAllDeviceLogs.mockResolvedValue({ success: true });
		deleteAllSystemLogs.mockResolvedValue({
			success: false,
			error: "system logs busy",
		});
		vi.stubGlobal(
			"confirm",
			vi.fn(() => true),
		);

		const AdminDevicesClientPage = await loadClientPage([
			{ value: [] },
			{ value: [] },
			{ value: false },
			{ value: false },
			{ value: false },
			{ value: null },
			{ value: "" },
		]);

		renderToStaticMarkup(<AdminDevicesClientPage />);
		await findButton("Delete device logs")?.onClick?.(
			{} as React.MouseEvent<HTMLButtonElement>,
		);
		await findButton("Delete system logs")?.onClick?.(
			{} as React.MouseEvent<HTMLButtonElement>,
		);
		await flushAsyncWork();

		assert.equal(
			toastState.success.mock.calls[0]?.[0],
			"Deleted 0 device logs",
		);
		assert.equal(toastState.error.mock.calls[0]?.[0], "system logs busy");
	});
});
