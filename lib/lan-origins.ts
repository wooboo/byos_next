import { networkInterfaces } from "os";

function configuredPorts() {
	return new Set([
		process.env.PORT || "3001",
		process.env.NEXT_PUBLIC_PORT || "3001",
		"3000",
		"3001",
	]);
}

function lanHosts(includeWildcard = false) {
	const hosts = new Set(["localhost", "127.0.0.1"]);
	if (includeWildcard) hosts.add("0.0.0.0");

	for (const entries of Object.values(networkInterfaces())) {
		for (const entry of entries ?? []) {
			if (entry.family === "IPv4" && !entry.internal) {
				hosts.add(entry.address);
			}
		}
	}

	return hosts;
}

function configuredOrigins() {
	return (process.env.ALLOWED_SERVER_ACTION_ORIGINS || "")
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);
}

export function getLanTrustedOrigins() {
	const origins = new Set<string>();

	for (const host of lanHosts()) {
		for (const port of configuredPorts()) {
			origins.add(`http://${host}:${port}`);
		}
	}

	if (process.env.BETTER_AUTH_URL) {
		origins.add(process.env.BETTER_AUTH_URL);
	}

	for (const value of configuredOrigins()) {
		origins.add(value.startsWith("http") ? value : `http://${value}`);
	}

	return Array.from(origins);
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

	return [
		...Array.from(hosts).flatMap((host) =>
			Array.from(ports).map((port) => `${host}:${port}`),
		),
		...Array.from(explicitOrigins),
	];
}
