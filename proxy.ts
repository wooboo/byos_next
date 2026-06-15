import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

// Paths that don't require authentication
const PUBLIC_PATHS = [
	"/api",
	"/_next",
	"/favicon.ico",
	"/sign-in",
	"/sign-up",
	"/recover",
];

function isPublicPath(pathname: string) {
	return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

function previewProxyDiagnostics(
	event: "public" | "redirect" | "authenticated",
	request: NextRequest,
) {
	const { pathname, searchParams } = request.nextUrl;
	if (!pathname.startsWith("/preview")) return;

	const payload = {
		pathname,
		raw: searchParams.get("raw") === "1",
		hasAccessToken: searchParams.has("access_token"),
	};

	if (event === "redirect") {
		console.warn("[preview-render] proxy redirecting preview to sign-in", {
			...payload,
			host: request.headers.get("host"),
			proto: request.headers.get("x-forwarded-proto"),
		});
		return;
	}

	console.info(`[preview-render] proxy ${event} preview`, payload);
}

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Skip auth for public paths
	if (isPublicPath(pathname)) {
		previewProxyDiagnostics("public", request);
		return NextResponse.next();
	}

	// Skip auth check if authentication is disabled (mono-user mode)
	if (!auth) {
		return NextResponse.next();
	}

	const session = await auth.api.getSession({
		headers: await headers(),
	});

	if (!session) {
		previewProxyDiagnostics("redirect", request);
		return NextResponse.redirect(new URL("/sign-in", request.url));
	}

	previewProxyDiagnostics("authenticated", request);

	return NextResponse.next();
}
