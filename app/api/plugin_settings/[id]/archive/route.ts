import { proxyToTRMNLMultipart } from "@/lib/api/proxy";
import { pluginSettingPath, proxyPluginSetting } from "../proxy";

/**
 * GET /api/plugin_settings/{id}/archive
 * Download a plugin setting archive
 *
 * Proxies to TRMNL API
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	return proxyPluginSetting(request, { params }, "/archive");
}

/**
 * POST /api/plugin_settings/{id}/archive
 * Upload a plugin setting archive
 *
 * Proxies to TRMNL API
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const path = await pluginSettingPath({ params }, "/archive");
	return proxyToTRMNLMultipart(path, request, {
		forwardAuth: true,
	});
}
