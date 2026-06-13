import { proxyPluginSetting } from "./proxy";

/**
 * DELETE /api/plugin_settings/{id}
 * Delete a plugin setting
 *
 * Proxies to TRMNL API
 */
export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	return proxyPluginSetting(request, { params }, "", "DELETE");
}
