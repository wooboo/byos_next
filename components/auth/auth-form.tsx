"use client";

import Link from "next/link";
import type { ChangeEventHandler, FormEventHandler, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthPageCardProps = {
	title: string;
	description: ReactNode;
	children: ReactNode;
};

export function AuthPageCard({
	title,
	description,
	children,
}: AuthPageCardProps) {
	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle className="text-2xl">{title}</CardTitle>
					<CardDescription>{description}</CardDescription>
				</CardHeader>
				<CardContent>{children}</CardContent>
			</Card>
		</div>
	);
}

type AuthFormProps = {
	onSubmit: FormEventHandler<HTMLFormElement>;
	children: ReactNode;
};

export function AuthForm({ onSubmit, children }: AuthFormProps) {
	return (
		<form onSubmit={onSubmit} className="space-y-4">
			{children}
		</form>
	);
}

type AuthMessageProps = {
	children: ReactNode;
	tone?: "error" | "success";
};

export function AuthMessage({ children, tone = "error" }: AuthMessageProps) {
	const className =
		tone === "success"
			? "rounded-md bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400"
			: "rounded-md bg-destructive/10 p-3 text-sm text-destructive";

	return <div className={className}>{children}</div>;
}

type AuthInputFieldProps = {
	id: string;
	label: string;
	type: "email" | "password" | "text";
	placeholder: string;
	value: string;
	onChange: ChangeEventHandler<HTMLInputElement>;
	autoComplete: string;
	disabled: boolean;
	helpText?: string;
	labelAction?: {
		href: string;
		label: string;
	};
};

export function AuthInputField({
	id,
	label,
	type,
	placeholder,
	value,
	onChange,
	autoComplete,
	disabled,
	helpText,
	labelAction,
}: AuthInputFieldProps) {
	return (
		<div className="space-y-2">
			{labelAction ? (
				<div className="flex items-center justify-between">
					<Label htmlFor={id}>{label}</Label>
					<Link
						href={labelAction.href}
						className="text-sm text-muted-foreground hover:text-primary"
					>
						{labelAction.label}
					</Link>
				</div>
			) : (
				<Label htmlFor={id}>{label}</Label>
			)}
			<Input
				id={id}
				type={type}
				placeholder={placeholder}
				value={value}
				onChange={onChange}
				required
				autoComplete={autoComplete}
				disabled={disabled}
			/>
			{helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
		</div>
	);
}

type AuthSubmitButtonProps = {
	isLoading: boolean;
	loadingLabel: string;
	children: ReactNode;
	disabled?: boolean;
};

export function AuthSubmitButton({
	isLoading,
	loadingLabel,
	children,
	disabled,
}: AuthSubmitButtonProps) {
	return (
		<Button type="submit" className="w-full" disabled={disabled ?? isLoading}>
			{isLoading ? loadingLabel : children}
		</Button>
	);
}

type AuthFooterLinkProps = {
	text: string;
	href: string;
	children: ReactNode;
};

export function AuthFooterLink({ text, href, children }: AuthFooterLinkProps) {
	return (
		<div className="text-center text-sm text-muted-foreground">
			{text}{" "}
			<Link href={href} className="text-primary hover:underline">
				{children}
			</Link>
		</div>
	);
}
