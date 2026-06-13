import { registryResponse } from "@/lib/trmnl/registry";

/**
 * GET /api/palettes
 * List all palettes.
 *
 * Served from a local 24h cache seeded by `data/trmnl/palettes.json`.
 * Set TRMNL_PROXY_LIVE=true to always proxy upstream.
 */
export async function GET() {
	return registryResponse("palettes");
}
