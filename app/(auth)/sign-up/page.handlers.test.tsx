import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, it, vi } from "vitest";

type StateEntry = {
	value: unknown;
	setter?: ReturnType<typeof vi.fn>;
};

const signUpState = vi.hoisted(() => ({
	routerPush: vi.fn(),
	routerRefresh: vi.fn(),
	formSubmit: null as
		| ((event: { preventDefault: () => void }) => Promise<void>)
		| null,
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: signUpState.routerPush,
		refresh: signUpState.routerRefresh,
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
	AuthFooterLink: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	AuthForm: ({
		children,
		onSubmit,
	}: {
		children: React.ReactNode;
		onSubmit: (event: { preventDefault: () => void }) => Promise<void>;
	}) => {
		signUpState.formSubmit = onSubmit;
		return <form>{children}</form>;
	},
	AuthInputField: ({ id }: { id: string }) => <div>{id}</div>,
	AuthMessage: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
	AuthPageCard: ({ children }: { children: React.ReactNode }) => (
		<section>{children}</section>
	),
	AuthSubmitButton: ({ children }: { children: React.ReactNode }) => (
		<button type="button">{children}</button>
	),
}));

async function loadPage(stateEntries: StateEntry[]) {
	vi.resetModules();
	const entries = stateEntries;
	let callIndex = 0;

	vi.doMock("react", async (importOriginal) => {
		const actual = await importOriginal<typeof import("react")>();
		return {
			...actual,
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

	return (await import("./page.tsx")).default;
}

afterEach(() => {
	vi.clearAllMocks();
	signUpState.routerPush.mockClear();
	signUpState.routerRefresh.mockClear();
	signUpState.formSubmit = null;
});

describe("Sign-up page handlers", () => {
	it("rejects mismatched passwords before calling auth", async () => {
		const errorSetter = vi.fn();
		const signUpEmail = vi.mocked(
			(await import("@/lib/auth/auth-client")).authClient.signUp.email,
		);

		const SignUpPage = await loadPage([
			{ value: "dev@example.com" },
			{ value: "password123" },
			{ value: "different123" },
			{ value: "Dev User" },
			{ value: "", setter: errorSetter },
			{ value: false },
		]);

		renderToStaticMarkup(<SignUpPage />);
		await signUpState.formSubmit?.({ preventDefault: vi.fn() });

		assert.equal(signUpEmail.mock.calls.length, 0);
		assert.equal(errorSetter.mock.calls[1]?.[0], "Passwords do not match");
	});

	it("rejects weak passwords before calling auth", async () => {
		const errorSetter = vi.fn();
		const signUpEmail = vi.mocked(
			(await import("@/lib/auth/auth-client")).authClient.signUp.email,
		);

		const SignUpPage = await loadPage([
			{ value: "dev@example.com" },
			{ value: "short" },
			{ value: "short" },
			{ value: "Dev User" },
			{ value: "", setter: errorSetter },
			{ value: false },
		]);

		renderToStaticMarkup(<SignUpPage />);
		await signUpState.formSubmit?.({ preventDefault: vi.fn() });

		assert.equal(signUpEmail.mock.calls.length, 0);
		assert.equal(
			errorSetter.mock.calls[1]?.[0],
			"Password must be at least 8 characters long",
		);
	});

	it("surfaces auth errors and clears loading state", async () => {
		const errorSetter = vi.fn();
		const loadingSetter = vi.fn();
		const signUpEmail = vi.mocked(
			(await import("@/lib/auth/auth-client")).authClient.signUp.email,
		);
		signUpEmail.mockResolvedValue({
			data: null,
			error: { message: "Email already exists" },
		});

		const SignUpPage = await loadPage([
			{ value: "dev@example.com" },
			{ value: "password123" },
			{ value: "password123" },
			{ value: "Dev User" },
			{ value: "", setter: errorSetter },
			{ value: false, setter: loadingSetter },
		]);

		renderToStaticMarkup(<SignUpPage />);
		await signUpState.formSubmit?.({ preventDefault: vi.fn() });

		assert.deepEqual(signUpEmail.mock.calls[0], [
			{
				email: "dev@example.com",
				password: "password123",
				name: "Dev User",
			},
		]);
		assert.equal(errorSetter.mock.calls[1]?.[0], "Email already exists");
		assert.deepEqual(
			loadingSetter.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});

	it("shows a generic error when sign-up throws unexpectedly", async () => {
		const errorSetter = vi.fn();
		const loadingSetter = vi.fn();
		const signUpEmail = vi.mocked(
			(await import("@/lib/auth/auth-client")).authClient.signUp.email,
		);
		signUpEmail.mockRejectedValue(new Error("network"));

		const SignUpPage = await loadPage([
			{ value: "dev@example.com" },
			{ value: "password123" },
			{ value: "password123" },
			{ value: "Dev User" },
			{ value: "", setter: errorSetter },
			{ value: false, setter: loadingSetter },
		]);

		renderToStaticMarkup(<SignUpPage />);
		await signUpState.formSubmit?.({ preventDefault: vi.fn() });

		assert.equal(
			errorSetter.mock.calls[1]?.[0],
			"An unexpected error occurred. Please try again.",
		);
		assert.deepEqual(
			loadingSetter.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});

	it("redirects to the app root after a successful sign-up", async () => {
		const errorSetter = vi.fn();
		const loadingSetter = vi.fn();
		const signUpEmail = vi.mocked(
			(await import("@/lib/auth/auth-client")).authClient.signUp.email,
		);
		signUpEmail.mockResolvedValue({
			data: { user: { id: "user-1" } },
			error: null,
		});

		const SignUpPage = await loadPage([
			{ value: "dev@example.com" },
			{ value: "password123" },
			{ value: "password123" },
			{ value: "Dev User" },
			{ value: "", setter: errorSetter },
			{ value: false, setter: loadingSetter },
		]);

		renderToStaticMarkup(<SignUpPage />);
		await signUpState.formSubmit?.({ preventDefault: vi.fn() });

		assert.equal(errorSetter.mock.calls[0]?.[0], "");
		assert.equal(signUpState.routerPush.mock.calls[0]?.[0], "/");
		assert.equal(signUpState.routerRefresh.mock.calls.length, 1);
		assert.equal(loadingSetter.mock.calls[0]?.[0], true);
	});
});
