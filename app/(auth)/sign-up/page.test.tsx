import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: vi.fn(),
		refresh: vi.fn(),
	}),
}));

vi.mock("@/lib/auth/auth-client", () => ({
	authClient: {
		signUp: {
			email: vi.fn(),
		},
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
	AuthMessage: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
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

type SignUpPageModule = typeof import("./page.tsx");
let moduleCache: SignUpPageModule | null = null;

async function getPage() {
	if (!moduleCache) {
		moduleCache = await import("./page.tsx");
	}
	return moduleCache.default;
}

describe("Sign-up page", () => {
	it("renders the account creation form fields", async () => {
		const SignUpPage = await getPage();
		const html = renderToStaticMarkup(<SignUpPage />);

		assert.match(html, /Create Account/);
		assert.match(html, /create a new account/);
		assert.match(html, /name:Name/);
		assert.match(html, /email:Email/);
		assert.match(html, /password:Password:Must be at least 8 characters long/);
		assert.match(html, /confirmPassword:Confirm Password/);
		assert.match(html, /Already have an account\?:\/sign-in:Sign in/);
	});
});
