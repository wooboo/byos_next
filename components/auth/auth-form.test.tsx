import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
	default: ({
		href,
		children,
		...props
	}: React.ComponentProps<"a"> & { href: string }) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

import {
	AuthFooterLink,
	AuthForm,
	AuthInputField,
	AuthMessage,
	AuthPageCard,
	AuthSubmitButton,
} from "./auth-form";

describe("auth-form", () => {
	it("renders the page card shell and nested content", () => {
		const html = renderToStaticMarkup(
			<AuthPageCard
				title="Sign in"
				description={
					<>
						Use your account to continue to <strong>BYOS</strong>.
					</>
				}
			>
				<div>Form content</div>
			</AuthPageCard>,
		);

		expect(html).toContain("min-h-screen");
		expect(html).toContain(">Sign in<");
		expect(html).toContain("continue to <strong>BYOS</strong>");
		expect(html).toContain(">Form content<");
	});

	it("renders form fields, help text, and footer links through the public API", () => {
		const handleSubmit = vi.fn();
		const handleChange = vi.fn();
		const html = renderToStaticMarkup(
			<>
				<AuthForm onSubmit={handleSubmit}>
					<AuthInputField
						id="password"
						label="Password"
						type="password"
						placeholder="Enter your password"
						value="secret"
						onChange={handleChange}
						autoComplete="current-password"
						disabled
						helpText="Use at least 12 characters."
						labelAction={{ href: "/recover", label: "Forgot password?" }}
					/>
					<AuthSubmitButton isLoading={false} loadingLabel="Signing in">
						Sign in
					</AuthSubmitButton>
				</AuthForm>
				<AuthFooterLink text="Need an account?" href="/sign-up">
					Sign up
				</AuthFooterLink>
			</>,
		);

		expect(html).toContain('href="/recover"');
		expect(html).toContain(">Forgot password?<");
		expect(html).toContain('id="password"');
		expect(html).toContain('type="password"');
		expect(html).toContain('placeholder="Enter your password"');
		expect(html).toContain('autoComplete="current-password"');
		expect(html).toContain('disabled=""');
		expect(html).toContain("Use at least 12 characters.");
		expect(html).toContain(">Sign in<");
		expect(html).toContain('href="/sign-up"');
		expect(html).toContain("Need an account?");
	});

	it("switches message and submit-button states for success and loading cases", () => {
		const html = renderToStaticMarkup(
			<>
				<AuthMessage tone="success">Password updated.</AuthMessage>
				<AuthMessage>Something went wrong.</AuthMessage>
				<AuthSubmitButton isLoading loadingLabel="Submitting">
					Submit
				</AuthSubmitButton>
				<AuthSubmitButton isLoading={false} loadingLabel="Unused" disabled>
					Disabled
				</AuthSubmitButton>
			</>,
		);

		expect(html).toContain("text-green-600");
		expect(html).toContain(">Password updated.<");
		expect(html).toContain("text-destructive");
		expect(html).toContain(">Something went wrong.<");
		expect(html).toContain(">Submitting<");
		expect(html).toContain(">Disabled<");
		expect(html.match(/disabled=""/g)).toHaveLength(2);
	});
});
