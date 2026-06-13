import { registryResponse } from "@/lib/trmnl/registry";

/**
 * GET /api/categories
 * List all plugin categories.
 *
 * Served from a local 24h cache seeded by `data/trmnl/categories.json`.
 * Set TRMNL_PROXY_LIVE=true to always proxy upstream.
 */
export async function GET() {
	return registryResponse("categories");
}
