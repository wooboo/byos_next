import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, it, vi } from "vitest";

type StateEntry = {
	value: unknown;
	setter?: ReturnType<typeof vi.fn>;
};

const signInState = vi.hoisted(() => ({
	routerPush: vi.fn(),
	routerRefresh: vi.fn(),
	formSubmit: null as
		| ((event: { preventDefault: () => void }) => Promise<void>)
		| null,
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: signInState.routerPush,
		refresh: signInState.routerRefresh,
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
		signInState.formSubmit = onSubmit;
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

async function loadForm(stateEntries: StateEntry[]) {
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

	return (await import("./sign-in-form.tsx")).default;
}

afterEach(() => {
	vi.clearAllMocks();
	signInState.routerPush.mockClear();
	signInState.routerRefresh.mockClear();
	signInState.formSubmit = null;
});

describe("SignInForm handlers", () => {
	it("skips auth submission when the database is not ready", async () => {
		const errorSetter = vi.fn();
		const loadingSetter = vi.fn();
		const signInEmail = vi.mocked(
			(await import("@/lib/auth/auth-client")).authClient.signIn.email,
		);

		const SignInForm = await loadForm([
			{ value: "dev@example.com" },
			{ value: "password123" },
			{ value: "", setter: errorSetter },
			{ value: false, setter: loadingSetter },
		]);

		renderToStaticMarkup(<SignInForm dbReady={false} />);
		await signInState.formSubmit?.({ preventDefault: vi.fn() });

		assert.equal(signInEmail.mock.calls.length, 0);
		assert.equal(errorSetter.mock.calls.length, 0);
		assert.equal(loadingSetter.mock.calls.length, 0);
	});

	it("surfaces sign-in errors and clears loading state", async () => {
		const errorSetter = vi.fn();
		const loadingSetter = vi.fn();
		const signInEmail = vi.mocked(
			(await import("@/lib/auth/auth-client")).authClient.signIn.email,
		);
		signInEmail.mockResolvedValue({
			data: null,
			error: { message: "Invalid credentials" },
		});

		const SignInForm = await loadForm([
			{ value: "dev@example.com" },
			{ value: "password123" },
			{ value: "", setter: errorSetter },
			{ value: false, setter: loadingSetter },
		]);

		renderToStaticMarkup(<SignInForm dbReady={true} />);
		await signInState.formSubmit?.({ preventDefault: vi.fn() });

		assert.deepEqual(signInEmail.mock.calls[0], [
			{
				email: "dev@example.com",
				password: "password123",
			},
		]);
		assert.equal(errorSetter.mock.calls[1]?.[0], "Invalid credentials");
		assert.deepEqual(
			loadingSetter.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});

	it("redirects to the app root after a successful sign-in", async () => {
		const errorSetter = vi.fn();
		const loadingSetter = vi.fn();
		const signInEmail = vi.mocked(
			(await import("@/lib/auth/auth-client")).authClient.signIn.email,
		);
		signInEmail.mockResolvedValue({
			data: { session: { id: "session-1" } },
			error: null,
		});

		const SignInForm = await loadForm([
			{ value: "dev@example.com" },
			{ value: "password123" },
			{ value: "", setter: errorSetter },
			{ value: false, setter: loadingSetter },
		]);

		renderToStaticMarkup(<SignInForm dbReady={true} />);
		await signInState.formSubmit?.({ preventDefault: vi.fn() });

		assert.equal(errorSetter.mock.calls[0]?.[0], "");
		assert.equal(signInState.routerPush.mock.calls[0]?.[0], "/");
		assert.equal(signInState.routerRefresh.mock.calls.length, 1);
		assert.equal(loadingSetter.mock.calls[0]?.[0], true);
	});

	it("shows a generic error when sign-in throws unexpectedly", async () => {
		const errorSetter = vi.fn();
		const loadingSetter = vi.fn();
		const signInEmail = vi.mocked(
			(await import("@/lib/auth/auth-client")).authClient.signIn.email,
		);
		signInEmail.mockRejectedValue(new Error("network"));

		const SignInForm = await loadForm([
			{ value: "dev@example.com" },
			{ value: "password123" },
			{ value: "", setter: errorSetter },
			{ value: false, setter: loadingSetter },
		]);

		renderToStaticMarkup(<SignInForm dbReady={true} />);
		await signInState.formSubmit?.({ preventDefault: vi.fn() });

		assert.equal(
			errorSetter.mock.calls[1]?.[0],
			"An unexpected error occurred. Please try again.",
		);
		assert.deepEqual(
			loadingSetter.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});
});
