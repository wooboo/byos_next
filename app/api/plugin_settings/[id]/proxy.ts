import { proxyToTRMNL } from "@/lib/api/proxy";

type PluginSettingParams = { params: Promise<{ id: string }> };

export async function proxyPluginSetting(
	request: Request,
	{ params }: PluginSettingParams,
	pathSuffix = "",
	method: "GET" | "DELETE" = "GET",
) {
	const { id } = await params;
	return proxyToTRMNL(
		`/api/plugin_settings/${id}${pathSuffix}`,
		method,
		request,
		{
			forwardAuth: true,
		},
	);
}

export async function pluginSettingPath(
	{ params }: PluginSettingParams,
	pathSuffix = "",
) {
	const { id } = await params;
	return `/api/plugin_settings/${id}${pathSuffix}`;
}
