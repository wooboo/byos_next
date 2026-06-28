/**
 * Local registry for read-only TRMNL data (models, palettes, categories, ips).
 *
 * Strategy:
 *  - Bundled JSON snapshot under `data/trmnl/<resource>.json` ships with the repo.
 *  - First hit fetches upstream, refreshes the in-memory cache, and best-effort
 *    persists to disk so future cold starts have fresher data.
 *  - 24h TTL: stale entries trigger a refresh on the next request.
 *  - On upstream failure we fall back to whatever snapshot we have (in-memory or
 *    on-disk), so the endpoints keep working offline.
 *  - Set `TRMNL_PROXY_LIVE=true` to bypass the cache entirely and proxy every
 *    request to upstream (useful for debugging or when you must see live data).
 */

import fs from "node:fs/promises";
import path from "node:path";

const TRMNL_API_BASE = "https://usetrmnl.com";
const DATA_DIR = path.join(process.cwd(), "data", "trmnl");
const TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

export type {
	RegistryResource,
	TrmnlModel,
	TrmnlPalette,
} from "./types";

import type { RegistryResource, TrmnlModel, TrmnlPalette } from "./types";

type WrappedList<T> = { data: T[] };
type RegistryItem = Record<string, unknown>;

export async function listModels(): Promise<TrmnlModel[]> {
	const payload = (await getRegistry("models")) as WrappedList<TrmnlModel>;
	return payload?.data ?? [];
}

export async function listPalettes(): Promise<TrmnlPalette[]> {
	const payload = (await getRegistry("palettes")) as WrappedList<TrmnlPalette>;
	return payload?.data ?? [];
}

export async function findModel(name: string): Promise<TrmnlModel | null> {
	const models = await listModels();
	return models.find((m) => m.name === name) ?? null;
}

export async function findPalette(id: string): Promise<TrmnlPalette | null> {
	const palettes = await listPalettes();
	return palettes.find((p) => p.id === id) ?? null;
}

type CacheEntry = { data: unknown; fetchedAt: number };

const memCache = new Map<RegistryResource, CacheEntry>();
const inflight = new Map<RegistryResource, Promise<unknown>>();

export function isProxyLive(): boolean {
	return process.env.TRMNL_PROXY_LIVE === "true";
}

async function readSnapshot(
	resource: RegistryResource,
): Promise<unknown | null> {
	try {
		const file = path.join(DATA_DIR, `${resource}.json`);
		const raw = await fs.readFile(file, "utf8");
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

async function writeSnapshot(
	resource: RegistryResource,
	data: unknown,
): Promise<void> {
	try {
		await fs.mkdir(DATA_DIR, { recursive: true });
		const file = path.join(DATA_DIR, `${resource}.json`);
		await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
	} catch {
		// Best-effort: serverless filesystems are often read-only. The in-memory
		// cache still serves subsequent requests in the same instance.
	}
}

async function fetchUpstream(resource: RegistryResource): Promise<unknown> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(`${TRMNL_API_BASE}/api/${resource}`, {
			headers: { "Content-Type": "application/json" },
			signal: controller.signal,
		});
		if (!res.ok) {
			throw new Error(`TRMNL /api/${resource} returned ${res.status}`);
		}
		return await res.json();
	} finally {
		clearTimeout(timeout);
	}
}

async function refresh(resource: RegistryResource): Promise<unknown> {
	let pending = inflight.get(resource);
	if (pending) return pending;

	pending = (async () => {
		try {
			const fresh = await fetchUpstream(resource);
			const snapshot = await readSnapshot(resource);
			const merged = mergeLocalSnapshotOverlay(resource, fresh, snapshot);
			memCache.set(resource, { data: merged, fetchedAt: Date.now() });
			await writeSnapshot(resource, merged);
			return merged;
		} catch (err) {
			const snapshot = await readSnapshot(resource);
			if (snapshot !== null) {
				memCache.set(resource, { data: snapshot, fetchedAt: Date.now() });
				return snapshot;
			}
			throw err;
		} finally {
			inflight.delete(resource);
		}
	})();

	inflight.set(resource, pending);
	return pending;
}

function getOverlayKey(resource: RegistryResource): "name" | "id" | null {
	switch (resource) {
		case "models":
			return "name";
		case "palettes":
			return "id";
		default:
			return null;
	}
}

function isWrappedList(value: unknown): value is WrappedList<RegistryItem> {
	return (
		typeof value === "object" &&
		value !== null &&
		Array.isArray((value as { data?: unknown }).data)
	);
}

function mergeLocalSnapshotOverlay(
	resource: RegistryResource,
	fresh: unknown,
	snapshot: unknown,
): unknown {
	const key = getOverlayKey(resource);
	if (!key || !isWrappedList(fresh) || !isWrappedList(snapshot)) return fresh;

	const merged = [...fresh.data];
	const seen = new Set(
		merged
			.map((item) => item[key])
			.filter((value): value is string => typeof value === "string"),
	);

	for (const item of snapshot.data) {
		const value = item[key];
		if (typeof value !== "string" || seen.has(value)) continue;
		merged.push(item);
		seen.add(value);
	}

	return { ...fresh, data: merged };
}

export async function getRegistry(
	resource: RegistryResource,
): Promise<unknown> {
	if (isProxyLive()) {
		return fetchUpstream(resource);
	}

	const entry = memCache.get(resource);
	if (entry && Date.now() - entry.fetchedAt < TTL_MS) {
		return entry.data;
	}

	return refresh(resource);
}
