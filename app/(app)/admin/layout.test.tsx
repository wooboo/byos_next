import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

const adminLayoutState = vi.hoisted(() => ({
	authValue: {
		api: {
			getSession: vi.fn(async () => ({
				user: { role: "admin" },
			})),
		},
	} as null | {
		api: {
			getSession: ReturnType<typeof vi.fn>;
		};
	},
	redirectTarget: null as string | null,
	headersCalls: 0,
}));

vi.mock("next/headers", () => ({
	headers: vi.fn(async () => {
		adminLayoutState.headersCalls += 1;
		return { get: vi.fn() };
	}),
}));

vi.mock("next/navigation", () => ({
	redirect: (target: string) => {
		adminLayoutState.redirectTarget = target;
		throw new Error(`REDIRECT:${target}`);
	},
}));

vi.mock("@/lib/auth/auth", () => ({
	get auth() {
		return adminLayoutState.authValue;
	},
}));

type AdminLayoutModule = typeof import("./layout.tsx");
let moduleCache: AdminLayoutModule | null = null;

async function getLayout() {
	if (!moduleCache) {
		moduleCache = await import("./layout.tsx");
	}
	return moduleCache.default;
}

describe("Admin layout", () => {
	it("renders children for admin sessions", async () => {
		adminLayoutState.redirectTarget = null;
		adminLayoutState.headersCalls = 0;
		adminLayoutState.authValue = {
			api: {
				getSession: vi.fn(async () => ({
					user: { role: "admin" },
				})),
			},
		};

		const AdminLayout = await getLayout();
		const html = renderToStaticMarkup(
			await AdminLayout({
				children: <div>admin child</div>,
			}),
		);

		assert.match(html, /admin child/);
		assert.equal(adminLayoutState.headersCalls, 1);
		assert.equal(adminLayoutState.redirectTarget, null);
	});

	it("redirects when auth is disabled", async () => {
		adminLayoutState.authValue = null;
		adminLayoutState.redirectTarget = null;

		const AdminLayout = await getLayout();

		await assert.rejects(
			async () =>
				AdminLayout({
					children: <div>admin child</div>,
				}),
			/REDIRECT:\//,
		);
		assert.equal(adminLayoutState.redirectTarget, "/");
	});

	it("redirects non-admin users", async () => {
		adminLayoutState.authValue = {
			api: {
				getSession: vi.fn(async () => ({
					user: { role: "user" },
				})),
			},
		};
		adminLayoutState.redirectTarget = null;

		const AdminLayout = await getLayout();

		await assert.rejects(
			async () =>
				AdminLayout({
					children: <div>admin child</div>,
				}),
			/REDIRECT:\//,
		);
		assert.equal(adminLayoutState.redirectTarget, "/");
	});
});
