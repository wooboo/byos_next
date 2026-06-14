import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, it, vi } from "vitest";

type StateEntry = {
	value: unknown;
	setter?: ReturnType<typeof vi.fn>;
};

type CapturedInputProps = {
	onChange?: (event: { target: { value: string } }) => void;
};

const recoverState = vi.hoisted(() => ({
	token: null as string | null,
	error: null as string | null,
	routerPush: vi.fn(),
	formSubmit: null as
		| ((event: { preventDefault: () => void }) => Promise<void>)
		| null,
	inputs: {} as Record<string, CapturedInputProps>,
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: recoverState.routerPush,
	}),
	useSearchParams: () => ({
		get: (name: string) => {
			if (name === "token") return recoverState.token;
			if (name === "error") return recoverState.error;
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
		recoverState.formSubmit = onSubmit;
		return <form>{children}</form>;
	},
	AuthInputField: ({
		id,
		onChange,
	}: {
		id: string;
		onChange?: (event: { target: { value: string } }) => void;
	}) => {
		recoverState.inputs[id] = { onChange };
		return <div>{id}</div>;
	},
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

async function loadPage(stateEntries: StateEntry[], runEffects = false) {
	vi.resetModules();
	const entries = stateEntries;
	let callIndex = 0;

	vi.doMock("react", async (importOriginal) => {
		const actual = await importOriginal<typeof import("react")>();
		return {
			...actual,
			useEffect: (effect: React.EffectCallback) => {
				if (runEffects) {
					effect();
				}
			},
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
	recoverState.token = null;
	recoverState.error = null;
	recoverState.formSubmit = null;
	recoverState.inputs = {};
	recoverState.routerPush.mockClear();
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("Recover page handlers", () => {
	it("hydrates the invalid-token message from the effect", async () => {
		const errorSetter = vi.fn();
		recoverState.error = "INVALID_TOKEN";

		const RecoverPage = await loadPage(
			[
				{ value: "" },
				{ value: "" },
				{ value: "" },
				{ value: "", setter: errorSetter },
				{ value: "" },
				{ value: false },
			],
			true,
		);

		renderToStaticMarkup(<RecoverPage />);

		assert.equal(
			errorSetter.mock.calls[0]?.[0],
			"The reset link is invalid or has expired. Please request a new one.",
		);
	});

	it("requests a reset email and uses the current origin in the redirect", async () => {
		const errorSetter = vi.fn();
		const successSetter = vi.fn();
		const loadingSetter = vi.fn();
		const authClient = (await import("@/lib/auth/auth-client"))
			.authClient as unknown as {
			forgetPassword: (options: {
				email: string;
				redirectTo: string;
			}) => Promise<{ error: { message: string } | null }>;
		};
		const forgetPassword = vi.mocked(authClient.forgetPassword);
		forgetPassword.mockResolvedValue({ error: null });
		vi.stubGlobal("window", {
			location: { origin: "https://byos.example" },
		});

		const RecoverPage = await loadPage([
			{ value: "dev@example.com" },
			{ value: "" },
			{ value: "" },
			{ value: "", setter: errorSetter },
			{ value: "", setter: successSetter },
			{ value: false, setter: loadingSetter },
		]);

		renderToStaticMarkup(<RecoverPage />);
		await recoverState.formSubmit?.({ preventDefault: vi.fn() });

		assert.deepEqual(forgetPassword.mock.calls[0], [
			{
				email: "dev@example.com",
				redirectTo: "https://byos.example/recover",
			},
		]);
		assert.equal(errorSetter.mock.calls[0]?.[0], "");
		assert.equal(successSetter.mock.calls[0]?.[0], "");
		assert.equal(
			successSetter.mock.calls[1]?.[0],
			"If an account exists with this email, you will receive a password reset link shortly.",
		);
		assert.deepEqual(
			loadingSetter.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});

	it("surfaces request-reset api errors and clears loading", async () => {
		const errorSetter = vi.fn();
		const successSetter = vi.fn();
		const loadingSetter = vi.fn();
		const authClient = (await import("@/lib/auth/auth-client"))
			.authClient as unknown as {
			forgetPassword: (options: {
				email: string;
				redirectTo: string;
			}) => Promise<{ error: { message?: string } | null }>;
		};
		const forgetPassword = vi.mocked(authClient.forgetPassword);
		forgetPassword.mockResolvedValue({
			error: { message: "Reset is unavailable" },
		});
		vi.stubGlobal("window", {
			location: { origin: "https://byos.example" },
		});

		const RecoverPage = await loadPage([
			{ value: "dev@example.com" },
			{ value: "" },
			{ value: "" },
			{ value: "", setter: errorSetter },
			{ value: "", setter: successSetter },
			{ value: false, setter: loadingSetter },
		]);

		renderToStaticMarkup(<RecoverPage />);
		await recoverState.formSubmit?.({ preventDefault: vi.fn() });

		assert.equal(errorSetter.mock.calls[1]?.[0], "Reset is unavailable");
		assert.equal(successSetter.mock.calls[0]?.[0], "");
		assert.deepEqual(
			loadingSetter.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});

	it("rejects reset-password submission when the passwords do not match", async () => {
		const errorSetter = vi.fn();
		recoverState.token = "reset-token";

		const RecoverPage = await loadPage([
			{ value: "" },
			{ value: "password123" },
			{ value: "different123" },
			{ value: "", setter: errorSetter },
			{ value: "" },
			{ value: false },
		]);

		renderToStaticMarkup(<RecoverPage />);
		await recoverState.formSubmit?.({ preventDefault: vi.fn() });

		assert.equal(errorSetter.mock.calls[1]?.[0], "Passwords do not match");
	});

	it("rejects reset-password submission when the password is too short", async () => {
		const errorSetter = vi.fn();
		recoverState.token = "reset-token";

		const RecoverPage = await loadPage([
			{ value: "" },
			{ value: "short" },
			{ value: "short" },
			{ value: "", setter: errorSetter },
			{ value: "" },
			{ value: false },
		]);

		renderToStaticMarkup(<RecoverPage />);
		await recoverState.formSubmit?.({ preventDefault: vi.fn() });

		assert.equal(
			errorSetter.mock.calls[1]?.[0],
			"Password must be at least 8 characters long",
		);
	});

	it("resets the password and redirects to sign-in", async () => {
		const errorSetter = vi.fn();
		const successSetter = vi.fn();
		const loadingSetter = vi.fn();
		const resetPassword = vi.mocked(
			(await import("@/lib/auth/auth-client")).authClient.resetPassword,
		);
		resetPassword.mockResolvedValue({ error: null });
		recoverState.token = "reset-token";
		vi.useFakeTimers();

		const RecoverPage = await loadPage([
			{ value: "" },
			{ value: "password123" },
			{ value: "password123" },
			{ value: "", setter: errorSetter },
			{ value: "", setter: successSetter },
			{ value: false, setter: loadingSetter },
		]);

		renderToStaticMarkup(<RecoverPage />);
		await recoverState.formSubmit?.({ preventDefault: vi.fn() });
		await vi.advanceTimersByTimeAsync(2000);

		assert.deepEqual(resetPassword.mock.calls[0], [
			{
				newPassword: "password123",
				token: "reset-token",
			},
		]);
		assert.equal(
			successSetter.mock.calls[1]?.[0],
			"Your password has been reset successfully. Redirecting to sign in...",
		);
		assert.equal(recoverState.routerPush.mock.calls[0]?.[0], "/sign-in");
		assert.equal(loadingSetter.mock.calls[0]?.[0], true);
	});

	it("surfaces reset-password api errors and clears loading", async () => {
		const errorSetter = vi.fn();
		const successSetter = vi.fn();
		const loadingSetter = vi.fn();
		const resetPassword = vi.mocked(
			(await import("@/lib/auth/auth-client")).authClient.resetPassword,
		);
		resetPassword.mockResolvedValue({
			error: { message: "Token expired" },
		});
		recoverState.token = "reset-token";

		const RecoverPage = await loadPage([
			{ value: "" },
			{ value: "password123" },
			{ value: "password123" },
			{ value: "", setter: errorSetter },
			{ value: "", setter: successSetter },
			{ value: false, setter: loadingSetter },
		]);

		renderToStaticMarkup(<RecoverPage />);
		await recoverState.formSubmit?.({ preventDefault: vi.fn() });

		assert.equal(successSetter.mock.calls[0]?.[0], "");
		assert.equal(errorSetter.mock.calls[1]?.[0], "Token expired");
		assert.deepEqual(
			loadingSetter.mock.calls.map((call) => call[0]),
			[true, false],
		);
	});
});
