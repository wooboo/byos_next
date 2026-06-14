import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

const usersPageState = vi.hoisted(() => ({
	renderCount: 0,
}));

vi.mock("./client-page", () => ({
	default: () => {
		usersPageState.renderCount += 1;
		return <div>admin-users-client</div>;
	},
}));

type UsersPageModule = typeof import("./page.tsx");
let moduleCache: UsersPageModule | null = null;

async function getPage() {
	if (!moduleCache) {
		moduleCache = await import("./page.tsx");
	}
	return moduleCache;
}

describe("Admin users page", () => {
	it("renders the client page wrapper and metadata", async () => {
		usersPageState.renderCount = 0;

		const module = await getPage();
		const html = renderToStaticMarkup(module.default());

		assert.match(html, /admin-users-client/);
		assert.equal(usersPageState.renderCount, 1);
		assert.equal(module.metadata.title, "User Management");
		assert.equal(
			module.metadata.description,
			"Manage users, roles, and permissions",
		);
	});
});
