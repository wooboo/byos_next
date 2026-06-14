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
		signIn: {
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
		disabled,
		labelAction,
	}: {
		id: string;
		label: string;
		helpText?: string;
		disabled?: boolean;
		labelAction?: { href: string; label: string };
	}) => (
		<div>
			{id}:{label}:{helpText ?? ""}:{String(disabled)}:
			{labelAction ? `${labelAction.href}:${labelAction.label}` : ""}
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
	AuthSubmitButton: ({
		children,
		disabled,
	}: {
		children: React.ReactNode;
		disabled?: boolean;
	}) => (
		<button type="button">
			{String(disabled)}:{children}
		</button>
	),
}));

type SignInFormModule = typeof import("./sign-in-form.tsx");
let moduleCache: SignInFormModule | null = null;

async function getForm() {
	if (!moduleCache) {
		moduleCache = await import("./sign-in-form.tsx");
	}
	return moduleCache.default;
}

describe("SignInForm", () => {
	it("renders enabled sign-in fields when the database is ready", async () => {
		const SignInForm = await getForm();
		const html = renderToStaticMarkup(
			<SignInForm dbReady={true} dbError={undefined} />,
		);

		assert.match(html, /Sign In/);
		assert.match(html, /access your account/);
		assert.match(html, /email:Email::false:/);
		assert.match(html, /password:Password::false:\/recover:Forgot password\?/);
		assert.match(html, /false:Sign In/);
		assert.match(html, /Don&#x27;t have an account\?:\/sign-up:Sign up/);
	});

	it("renders the database warning and disables the form when the database is down", async () => {
		const SignInForm = await getForm();
		const html = renderToStaticMarkup(
			<SignInForm dbReady={false} dbError="connection refused" />,
		);

		assert.match(html, /Database is not reachable/);
		assert.match(html, /DATABASE_URL/);
		assert.match(html, /AUTH_ENABLED=false/);
		assert.match(html, /connection refused/);
		assert.match(html, /email:Email::true:/);
		assert.match(html, /password:Password::true:\/recover:Forgot password\?/);
		assert.match(html, /true:Sign In/);
	});
});
