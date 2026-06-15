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

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// Skip auth for public paths
	if (isPublicPath(pathname)) {
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
		return NextResponse.redirect(new URL("/sign-in", request.url));
	}

	return NextResponse.next();
}
