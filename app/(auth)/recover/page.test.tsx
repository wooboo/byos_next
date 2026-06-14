import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

const recoverState = vi.hoisted(() => ({
	token: null as string | null,
	error: null as string | null,
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: vi.fn(),
	}),
	useSearchParams: () => ({
		get: (name: string) => {
			if (name === "token") {
				return recoverState.token;
			}
			if (name === "error") {
				return recoverState.error;
			}
			return null;
		},
	}),
}));

vi.mock("@/lib/auth/auth-client", () => ({
	authClient: {
		forgetPassword: vi.fn(),
		resetPassword: vi.fn(),
	},
}));

vi.mock("@/components/auth/auth-form", () => ({
	AuthFooterLink: ({
		text,
		href,
		children,
	}: {
		text: string;
		href: string;
		children: React.ReactNode;
	}) => (
		<div>
			{text}:{href}:{children}
		</div>
	),
	AuthForm: ({ children }: { children: React.ReactNode }) => (
		<form>{children}</form>
	),
	AuthInputField: ({
		id,
		label,
		helpText,
	}: {
		id: string;
		label: string;
		helpText?: string;
	}) => (
		<div>
			{id}:{label}:{helpText ?? ""}
		</div>
	),
	AuthMessage: ({
		tone,
		children,
	}: {
		tone?: string;
		children: React.ReactNode;
	}) => (
		<div>
			{tone ?? "default"}:{children}
		</div>
	),
	AuthPageCard: ({
		title,
		description,
		children,
	}: {
		title: string;
		description: string;
		children: React.ReactNode;
	}) => (
		<section>
			<h1>{title}</h1>
			<p>{description}</p>
			{children}
		</section>
	),
	AuthSubmitButton: ({ children }: { children: React.ReactNode }) => (
		<button type="button">{children}</button>
	),
}));

type RecoverPageModule = typeof import("./page.tsx");
let moduleCache: RecoverPageModule | null = null;

async function getPage() {
	if (!moduleCache) {
		moduleCache = await import("./page.tsx");
	}
	return moduleCache.default;
}

describe("Recover page", () => {
	it("renders the reset-request form when no token is present", async () => {
		recoverState.token = null;
		recoverState.error = null;

		const RecoverPage = await getPage();
		const html = renderToStaticMarkup(<RecoverPage />);

		assert.match(html, /Recover Password/);
		assert.match(html, /Send Reset Link/);
		assert.match(html, /email:Email/);
	});

	it("renders the reset-password form when token is present", async () => {
		recoverState.token = "reset-token";
		recoverState.error = null;

		const RecoverPage = await getPage();
		const html = renderToStaticMarkup(<RecoverPage />);

		assert.match(html, /Reset Password/);
		assert.match(html, /Enter your new password below/);
		assert.match(
			html,
			/newPassword:New Password:Must be at least 8 characters long/,
		);
		assert.match(html, /confirmPassword:Confirm New Password/);
	});
});
