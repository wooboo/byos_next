import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("lucide-react", () => ({
	MoreHorizontal: ({ className }: { className?: string }) => (
		<span className={className}>more</span>
	),
}));

vi.mock("@/components/ui/button", () => ({
	Button: ({
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
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
		<p>{children}</p>
	),
	CardHeader: ({ children }: { children: React.ReactNode }) => (
		<header>{children}</header>
	),
	CardTitle: ({ children }: { children: React.ReactNode }) => (
		<h2>{children}</h2>
	),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuContent: ({
		children,
		align,
	}: {
		children: React.ReactNode;
		align?: string;
	}) => <div data-align={align}>{children}</div>,
	DropdownMenuItem: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	DropdownMenuSeparator: () => <hr />,
	DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

vi.mock("@/components/ui/table", () => ({
	Table: ({ children }: { children: React.ReactNode }) => (
		<table>{children}</table>
	),
	TableBody: ({ children }: { children: React.ReactNode }) => (
		<tbody>{children}</tbody>
	),
	TableCell: ({
		children,
		colSpan,
	}: {
		children: React.ReactNode;
		colSpan?: number;
		className?: string;
	}) => <td colSpan={colSpan}>{children}</td>,
	TableHead: ({ children }: { children?: React.ReactNode }) => (
		<th>{children}</th>
	),
	TableHeader: ({ children }: { children: React.ReactNode }) => (
		<thead>{children}</thead>
	),
	TableRow: ({ children }: { children: React.ReactNode }) => (
		<tr>{children}</tr>
	),
}));

describe("AdminResourceTable", () => {
	it("renders the loading row", async () => {
		const { AdminResourceTable } = await import("./admin-resource-table");

		const html = renderToStaticMarkup(
			<AdminResourceTable
				title="Users"
				description="Manage users"
				headers={["Email", "Role"]}
				colSpan={3}
				loading
				empty={false}
				loadingLabel="Loading users..."
				emptyLabel="No users"
			>
				<tr>
					<td>Hidden row</td>
				</tr>
			</AdminResourceTable>,
		);

		assert.match(html, /Users/);
		assert.match(html, /Manage users/);
		assert.match(html, /Email/);
		assert.match(html, /Role/);
		assert.match(html, /Loading users/);
		assert.match(html, /colSpan="3"/);
		assert.doesNotMatch(html, /Hidden row/);
	});

	it("renders the empty row when not loading", async () => {
		const { AdminResourceTable } = await import("./admin-resource-table");

		const html = renderToStaticMarkup(
			<AdminResourceTable
				title="Devices"
				description="Manage devices"
				headers={["Name"]}
				colSpan={2}
				loading={false}
				empty
				loadingLabel="Loading devices..."
				emptyLabel="No devices"
			>
				<tr>
					<td>Hidden device</td>
				</tr>
			</AdminResourceTable>,
		);

		assert.match(html, /No devices/);
		assert.doesNotMatch(html, /Hidden device/);
	});

	it("renders child rows and row actions", async () => {
		const { AdminResourceTable, AdminRowActions, DropdownMenuItem } =
			await import("./admin-resource-table");

		const html = renderToStaticMarkup(
			<AdminResourceTable
				title="Devices"
				description="Manage devices"
				headers={["Name"]}
				colSpan={2}
				loading={false}
				empty={false}
				loadingLabel="Loading devices..."
				emptyLabel="No devices"
			>
				<tr>
					<td>Kitchen</td>
					<td>
						<AdminRowActions>
							<DropdownMenuItem>Disable</DropdownMenuItem>
						</AdminRowActions>
					</td>
				</tr>
			</AdminResourceTable>,
		);

		assert.match(html, /Kitchen/);
		assert.match(html, /Disable/);
		assert.match(html, /data-align="end"/);
		assert.match(html, /more/);
		assert.doesNotMatch(html, /No devices/);
	});
});
