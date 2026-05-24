import { existsSync } from "fs";
import { networkInterfaces } from "os";
import type { NextConfig } from "next";

const serverExternalPackages = [
	"@takumi-rs/core",
	"@takumi-rs/helpers",
	"@sparticuz/chromium-min",
];

const browserTracingIncludes: string[] = [];

function getLanServerActionOrigins() {
	const ports = new Set([
		process.env.PORT || "3001",
		process.env.NEXT_PUBLIC_PORT || "3001",
		"3000",
		"3001",
	]);

	const hosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
	const explicitOrigins = new Set<string>();

	for (const entries of Object.values(networkInterfaces())) {
		for (const entry of entries ?? []) {
			if (entry.family === "IPv4" && !entry.internal) {
				hosts.add(entry.address);
			}
		}
	}

	for (const value of (process.env.ALLOWED_SERVER_ACTION_ORIGINS || "")
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean)) {
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

const serverActionAllowedOrigins = getLanServerActionOrigins();
const allowedDevOrigins = Array.from(
	new Set(
		serverActionAllowedOrigins.map((origin) => origin.replace(/:\d+$/, "")),
	),
);

// Detect which optional browser packages are installed at build time.
if (existsSync("node_modules/puppeteer-core")) {
	serverExternalPackages.push("puppeteer-core");
	browserTracingIncludes.push("./node_modules/puppeteer-core/**/*");
}

if (existsSync("node_modules/puppeteer")) {
	serverExternalPackages.push("puppeteer");
	browserTracingIncludes.push("./node_modules/puppeteer/**/*");
}

const nextConfig: NextConfig = {
	/* config options here */
	trailingSlash: false,
	skipTrailingSlashRedirect: true,
	cacheComponents: true,
	output: "standalone",
	// Mark native modules as external for server components
	serverExternalPackages,
	allowedDevOrigins,
	// Allow Server Actions from the local network. Without this, Next's
	// Origin/Host protection rejects writes when the app is opened via LAN IP
	// instead of localhost (settings save, recipe params, playlist changes, etc.).
	experimental: {
		serverActions: {
			allowedOrigins: serverActionAllowedOrigins,
		},
	},
	...(browserTracingIncludes.length > 0 && {
		outputFileTracingIncludes: {
			"/**": browserTracingIncludes,
		},
	}),
	images: {
		remotePatterns: [
			{ protocol: "https", hostname: "raw.githubusercontent.com" },
			{ protocol: "https", hostname: "github.com" },
			{ protocol: "https", hostname: "*.github.io" },
			{ protocol: "https", hostname: "trmnl.com" },
			{ protocol: "https", hostname: "usetrmnl.com" },
			{ protocol: "https", hostname: "trmnl.s3.us-east-2.amazonaws.com" },
			{
				protocol: "https",
				hostname: "trmnl-public.s3.us-east-2.amazonaws.com",
			},
		],
	},
};

export default nextConfig;
