"use client";

import { MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

type AdminResourceTableProps = {
	title: string;
	description: ReactNode;
	headers: ReactNode[];
	colSpan: number;
	loading: boolean;
	empty: boolean;
	loadingLabel: string;
	emptyLabel: string;
	children: ReactNode;
};

export function AdminResourceTable({
	title,
	description,
	headers,
	colSpan,
	loading,
	empty,
	loadingLabel,
	emptyLabel,
	children,
}: AdminResourceTableProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							{headers.map((header, index) => (
								<TableHead key={index}>{header}</TableHead>
							))}
							<TableHead className="w-[70px]" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{loading ? (
							<TableRow>
								<TableCell colSpan={colSpan} className="text-center py-8">
									{loadingLabel}
								</TableCell>
							</TableRow>
						) : empty ? (
							<TableRow>
								<TableCell colSpan={colSpan} className="text-center py-8">
									{emptyLabel}
								</TableCell>
							</TableRow>
						) : (
							children
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

type AdminRowActionsProps = {
	children: ReactNode;
};

export function AdminRowActions({ children }: AdminRowActionsProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon">
					<MoreHorizontal className="size-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">{children}</DropdownMenuContent>
		</DropdownMenu>
	);
}

export { DropdownMenuItem, DropdownMenuSeparator };
