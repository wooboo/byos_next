import { registryResponse } from "@/lib/trmnl/registry";

/**
 * GET /api/models
 * List all device models.
 *
 * Served from a local 24h cache seeded by `data/trmnl/models.json`.
 * Set TRMNL_PROXY_LIVE=true to always proxy upstream.
 */
export async function GET() {
	return registryResponse("models");
}
