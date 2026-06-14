import assert from "node:assert/strict";
import * as React from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, it, vi } from "vitest";

const signInState = vi.hoisted(() => ({
	dbStatus: {
		ready: true,
		error: null as string | null,
	},
	lastProps: null as { dbReady: boolean; dbError?: string | null } | null,
}));

vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return {
		...actual,
		Suspense: ({ children }: { children: React.ReactNode }) => <>{children}</>,
	};
});

vi.mock("@/lib/database/utils", () => ({
	getDbStatus: vi.fn(async () => signInState.dbStatus),
}));

vi.mock("next/server", () => ({
	connection: vi.fn(async () => undefined),
}));

vi.mock("./sign-in-form", () => ({
	default: (props: { dbReady: boolean; dbError?: string | null }) => {
		signInState.lastProps = props;
		return <div>sign-in-form:{JSON.stringify(props)}</div>;
	},
}));

type SignInPageModule = typeof import("./page.tsx");
let moduleCache: SignInPageModule | null = null;

async function getPage() {
	if (!moduleCache) {
		moduleCache = await import("./page.tsx");
	}
	return moduleCache.default;
}

async function renderAsync(element: React.ReactElement) {
	const stream = await renderToReadableStream(element);
	await stream.allReady;
	return (await new Response(stream).text()).replaceAll("<!-- -->", "");
}

describe("Sign-in page", () => {
	it("passes database readiness through to the sign-in form", async () => {
		signInState.dbStatus = { ready: false, error: "db down" };
		signInState.lastProps = null;

		const SignInPage = await getPage();
		const html = await renderAsync(<SignInPage />);

		assert.ok(signInState.lastProps);
		assert.deepEqual(signInState.lastProps, {
			dbReady: false,
			dbError: "db down",
		});
		assert.match(html, /sign-in-form:/);
		assert.match(html, /dbReady/);
		assert.match(html, /db down/);
	});
});
