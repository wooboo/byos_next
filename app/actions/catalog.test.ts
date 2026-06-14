import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogEntry } from "@/lib/catalog";

const state = vi.hoisted(() => ({
	checkDbConnection: vi.fn(),
	deleteRedirect: vi.fn(),
	fetchCatalog: vi.fn(),
	fetchTrmnlRecipesPage: vi.fn(),
	getCurrentUserId: vi.fn(),
	isExternalCatalogEnabled: vi.fn(),
	revalidatePath: vi.fn(),
	withUserScope: vi.fn(),
	withUserScopeTransaction: vi.fn(),
	zipLoadAsync: vi.fn(),
}));

function makeEntry(overrides: Partial<CatalogEntry> = {}): CatalogEntry {
	return {
		name: "Clock",
		trmnlp: {
			id: 1,
			repo: "acme/clock",
			zip_url: "https://example.com/clock.zip",
			zip_entry_path: null,
			version: "1.0.0",
		},
		logo_url: null,
		screenshot_url: null,
		license: "MIT",
		byos: {},
		author: { github: "acme" },
		funding: {},
		author_bio: { description: "Clock", category: "utility" },
		...overrides,
	};
}

async function loadCatalog() {
	vi.resetModules();
	vi.doMock("jszip", () => ({
		default: {
			loadAsync: state.zipLoadAsync,
		},
	}));
	vi.doMock("next/cache", () => ({
		revalidatePath: state.revalidatePath,
	}));
	vi.doMock("next/navigation", () => ({
		redirect: state.deleteRedirect,
	}));
	vi.doMock("@/lib/auth/get-user", () => ({
		getCurrentUserId: state.getCurrentUserId,
	}));
	vi.doMock("@/lib/catalog", () => ({
		fetchCatalog: state.fetchCatalog,
		fetchTrmnlRecipesPage: state.fetchTrmnlRecipesPage,
		isExternalCatalogEnabled: state.isExternalCatalogEnabled,
	}));
	vi.doMock("@/lib/database/scoped-db", () => ({
		withUserScope: state.withUserScope,
		withUserScopeTransaction: state.withUserScopeTransaction,
	}));
	vi.doMock("@/lib/database/utils", () => ({
		checkDbConnection: state.checkDbConnection,
	}));

	return import("./catalog");
}

describe("catalog actions", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		vi.resetModules();
		state.checkDbConnection.mockReset();
		state.deleteRedirect.mockReset();
		state.fetchCatalog.mockReset();
		state.fetchTrmnlRecipesPage.mockReset();
		state.getCurrentUserId.mockReset();
		state.isExternalCatalogEnabled.mockReset();
		state.revalidatePath.mockReset();
		state.withUserScope.mockReset();
		state.withUserScopeTransaction.mockReset();
		state.zipLoadAsync.mockReset();
	});

	it("refuses community installs when the external catalog is disabled", async () => {
		state.isExternalCatalogEnabled.mockReturnValue(false);
		const { installCommunityRecipe } = await loadCatalog();

		await expect(installCommunityRecipe(makeEntry())).resolves.toEqual({
			success: false,
			error: "External catalog is disabled on this server",
		});
	});

	it("rejects installs for entries outside the trusted catalog", async () => {
		state.isExternalCatalogEnabled.mockReturnValue(true);
		state.fetchCatalog.mockResolvedValue([]);
		const { installCommunityRecipe } = await loadCatalog();

		await expect(installCommunityRecipe(makeEntry())).resolves.toEqual({
			success: false,
			error: "Recipe not found in the trusted catalog",
		});
	});

	it("rejects installs when the trusted catalog entry differs from the client payload", async () => {
		state.isExternalCatalogEnabled.mockReturnValue(true);
		state.fetchCatalog.mockResolvedValue([makeEntry({ name: "Different" })]);
		const { installCommunityRecipe } = await loadCatalog();

		await expect(installCommunityRecipe(makeEntry())).resolves.toEqual({
			success: false,
			error: "Recipe not found in the trusted catalog",
		});
	});

	it("rejects installs when a trusted entry has no zip url", async () => {
		const entry = makeEntry({
			trmnlp: {
				...makeEntry().trmnlp,
				zip_url: null,
			},
		});

		state.isExternalCatalogEnabled.mockReturnValue(true);
		state.fetchCatalog.mockResolvedValue([entry]);
		const { installCommunityRecipe } = await loadCatalog();

		await expect(installCommunityRecipe(entry)).resolves.toEqual({
			success: false,
			error: "No zip_url available for this recipe",
		});
	});

	it("installs a trusted recipe archive and stores extracted files", async () => {
		const entry = makeEntry();
		const insertRecipe = vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({
				onConflict: vi.fn().mockReturnValue({
					returning: vi.fn().mockReturnValue({
						executeTakeFirstOrThrow: vi
							.fn()
							.mockResolvedValue({ id: "recipe-1" }),
					}),
				}),
			}),
		});
		const deleteRecipeFiles = vi.fn().mockReturnValue({
			where: vi.fn().mockReturnThis(),
			execute: vi.fn().mockResolvedValue(undefined),
		});
		const insertFiles = vi.fn().mockReturnValue({
			values: vi.fn().mockReturnValue({
				execute: vi.fn().mockResolvedValue(undefined),
			}),
		});

		state.isExternalCatalogEnabled.mockReturnValue(true);
		state.fetchCatalog.mockResolvedValue([entry]);
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.zipLoadAsync.mockResolvedValue({
			forEach: (
				callback: (
					relativePath: string,
					file: { dir: boolean; async: (kind: string) => Promise<Uint8Array> },
				) => void,
			) => {
				callback("index.liquid", {
					dir: false,
					async: vi
						.fn()
						.mockResolvedValue(new TextEncoder().encode("Hello from zip")),
				});
			},
		});
		state.withUserScopeTransaction.mockImplementation(async (callback) =>
			callback({
				deleteFrom: deleteRecipeFiles,
				insertInto: vi.fn((table: string) =>
					table === "recipes" ? insertRecipe() : insertFiles(),
				),
			}),
		);
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(new Uint8Array([1, 2, 3]).buffer, {
				status: 200,
				headers: { "content-length": "3" },
			}),
		);
		const { installCommunityRecipe } = await loadCatalog();

		await expect(installCommunityRecipe(entry)).resolves.toEqual({
			success: true,
			slug: "clock",
		});
		expect(state.revalidatePath).toHaveBeenCalledWith("/recipes");
	});

	it("returns a fetch status error when the recipe zip download fails", async () => {
		const entry = makeEntry();

		state.isExternalCatalogEnabled.mockReturnValue(true);
		state.fetchCatalog.mockResolvedValue([entry]);
		state.getCurrentUserId.mockResolvedValue("user-1");
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(null, { status: 502 }),
		);
		const { installCommunityRecipe } = await loadCatalog();

		await expect(installCommunityRecipe(entry)).resolves.toEqual({
			success: false,
			error: "Failed to download ZIP: 502",
		});
	});

	it("rejects archives whose declared size exceeds the limit", async () => {
		const entry = makeEntry();

		state.isExternalCatalogEnabled.mockReturnValue(true);
		state.fetchCatalog.mockResolvedValue([entry]);
		state.getCurrentUserId.mockResolvedValue("user-1");
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(new Uint8Array([1]).buffer, {
				status: 200,
				headers: { "content-length": String(21 * 1024 * 1024) },
			}),
		);
		const { installCommunityRecipe } = await loadCatalog();

		await expect(installCommunityRecipe(entry)).resolves.toEqual({
			success: false,
			error: "ZIP archive exceeds size limit",
		});
	});

	it("rejects archives whose extracted files exceed the decompression limit", async () => {
		const entry = makeEntry();

		state.isExternalCatalogEnabled.mockReturnValue(true);
		state.fetchCatalog.mockResolvedValue([entry]);
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.zipLoadAsync.mockResolvedValue({
			forEach: (
				callback: (
					relativePath: string,
					file: { dir: boolean; async: (kind: string) => Promise<Uint8Array> },
				) => void,
			) => {
				callback("huge.txt", {
					dir: false,
					async: vi.fn().mockResolvedValue(new Uint8Array(6 * 1024 * 1024)),
				});
			},
		});
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(new Uint8Array([1, 2, 3]).buffer, {
				status: 200,
				headers: { "content-length": "3" },
			}),
		);
		const { installCommunityRecipe } = await loadCatalog();

		await expect(installCommunityRecipe(entry)).resolves.toEqual({
			success: false,
			error: "ZIP archive exceeds decompression size limit",
		});
	});

	it("rejects archives that contain no decodable text files", async () => {
		const entry = makeEntry();

		state.isExternalCatalogEnabled.mockReturnValue(true);
		state.fetchCatalog.mockResolvedValue([entry]);
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.zipLoadAsync.mockResolvedValue({
			forEach: (
				callback: (
					relativePath: string,
					file: { dir: boolean; async: (kind: string) => Promise<Uint8Array> },
				) => void,
			) => {
				callback("binary.dat", {
					dir: false,
					async: vi.fn().mockResolvedValue(new Uint8Array([0xff, 0xfe])),
				});
			},
		});
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(new Uint8Array([1, 2, 3]).buffer, {
				status: 200,
				headers: { "content-length": "3" },
			}),
		);
		const { installCommunityRecipe } = await loadCatalog();

		await expect(installCommunityRecipe(entry)).resolves.toEqual({
			success: false,
			error: "No files found in the ZIP archive",
		});
	});

	it("returns database upsert errors while installing a recipe", async () => {
		const entry = makeEntry();

		state.isExternalCatalogEnabled.mockReturnValue(true);
		state.fetchCatalog.mockResolvedValue([entry]);
		state.getCurrentUserId.mockResolvedValue("user-1");
		state.zipLoadAsync.mockResolvedValue({
			forEach: (
				callback: (
					relativePath: string,
					file: { dir: boolean; async: (kind: string) => Promise<Uint8Array> },
				) => void,
			) => {
				callback("index.liquid", {
					dir: false,
					async: vi.fn().mockResolvedValue(new TextEncoder().encode("hello")),
				});
			},
		});
		state.withUserScopeTransaction.mockRejectedValue(
			new Error("duplicate key value violates unique constraint"),
		);
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(new Uint8Array([1, 2, 3]).buffer, {
				status: 200,
				headers: { "content-length": "3" },
			}),
		);
		const { installCommunityRecipe } = await loadCatalog();

		await expect(installCommunityRecipe(entry)).resolves.toEqual({
			success: false,
			error: "duplicate key value violates unique constraint",
		});
	});

	it("loads official recipes through the catalog module", async () => {
		state.fetchTrmnlRecipesPage.mockResolvedValue({
			recipes: [],
			currentPage: 2,
		});
		const { loadOfficialRecipesPage } = await loadCatalog();

		await expect(loadOfficialRecipesPage(2)).resolves.toEqual({
			recipes: [],
			currentPage: 2,
		});
		expect(state.fetchTrmnlRecipesPage).toHaveBeenCalledWith(2);
	});

	it("throws when deleting a recipe without a database connection", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: false });
		const { deleteRecipe } = await loadCatalog();

		await expect(deleteRecipe("clock")).rejects.toThrow(
			"Database client not initialized",
		);
	});

	it("deletes a recipe and redirects back to recipes", async () => {
		state.checkDbConnection.mockResolvedValue({ ready: true });
		state.withUserScope.mockImplementation(async (callback) =>
			callback({
				deleteFrom: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						execute: vi.fn().mockResolvedValue(undefined),
					}),
				}),
			}),
		);
		const { deleteRecipe } = await loadCatalog();

		await deleteRecipe("clock");
		expect(state.revalidatePath).toHaveBeenCalledWith("/recipes");
		expect(state.deleteRedirect).toHaveBeenCalledWith("/recipes");
	});
});
