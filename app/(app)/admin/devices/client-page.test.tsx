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
	Button: ({ children }: { children: React.ReactNode }) => (
		<button type="button">{children}</button>
	),
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
let moduleCache: ClientPageModule | null = null;

async function getClientPage() {
	if (!moduleCache) {
		moduleCache = await import("./client-page.tsx");
	}
	return moduleCache.default;
}

describe("Admin devices client page", () => {
	it("renders maintenance actions and the loading device table on SSR", async () => {
		const AdminDevicesClientPage = await getClientPage();
		const html = renderToStaticMarkup(<AdminDevicesClientPage />);

		assert.match(html, /Device Management/);
		assert.match(html, /Admin Maintenance/);
		assert.match(html, /Delete device logs/);
		assert.match(html, /Delete system logs/);
		assert.match(html, /Loading devices\.\.\./);
		assert.match(
			html,
			/Name\|Friendly ID\|API Key\|MAC Address\|Owner\|Created/,
		);
	});
});
