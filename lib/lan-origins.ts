import { networkInterfaces } from "os";

type NetworkInterfaceInfo = NonNullable<
	ReturnType<typeof networkInterfaces>[string]
>[number];

function configuredPorts() {
	return new Set([
		process.env.PORT || "3001",
		process.env.NEXT_PUBLIC_PORT || "3001",
		"3000",
		"3001",
	]);
}

function isExternalIpv4(entry: NetworkInterfaceInfo) {
	return entry.family === "IPv4" && !entry.internal;
}

function lanAddresses() {
	return Object.values(networkInterfaces())
		.flatMap((entries) => entries ?? [])
		.filter(isExternalIpv4)
		.map((entry) => entry.address);
}

function lanHosts(includeWildcard = false) {
	return new Set([
		"localhost",
		"127.0.0.1",
		...(includeWildcard ? ["0.0.0.0"] : []),
		...lanAddresses(),
	]);
}

function configuredOrigins() {
	return (process.env.ALLOWED_SERVER_ACTION_ORIGINS || "")
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);
}

function hostPortOrigins(
	hosts: Set<string>,
	ports: Set<string>,
	protocol = "",
) {
	return Array.from(hosts).flatMap((host) =>
		Array.from(ports).map((port) => `${protocol}${host}:${port}`),
	);
}

function asHttpOrigin(value: string) {
	return value.startsWith("http") ? value : `http://${value}`;
}

function isConfigured(value: string | undefined): value is string {
	return value !== undefined && value.length > 0;
}

export function getLanTrustedOrigins() {
	return Array.from(
		new Set([
			...hostPortOrigins(lanHosts(), configuredPorts(), "http://"),
			...[process.env.BETTER_AUTH_URL].filter(isConfigured),
			...configuredOrigins().map(asHttpOrigin),
		]),
	);
}

export function getLanServerActionOrigins() {
	const ports = configuredPorts();
	const hosts = lanHosts(true);
	const explicitOrigins = new Set<string>();

	for (const value of configuredOrigins()) {
		const withoutProtocol = value.replace(/^https?:\/\//, "");
		if (/:\d+$/.test(withoutProtocol)) {
			explicitOrigins.add(withoutProtocol);
		} else {
			hosts.add(withoutProtocol);
		}
	}

	return [...hostPortOrigins(hosts, ports), ...Array.from(explicitOrigins)];
}
