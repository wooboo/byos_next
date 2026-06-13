import { registryResponse } from "@/lib/trmnl/registry";

/**
 * GET /api/ips
 * List all TRMNL server IP addresses.
 *
 * Served from a local 24h cache seeded by `data/trmnl/ips.json`.
 * Set TRMNL_PROXY_LIVE=true to always proxy upstream.
 */
export async function GET() {
	return registryResponse("ips");
}
