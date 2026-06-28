import type { CookieData } from "puppeteer-core";
import { getBrowser } from "@/lib/recipes/chrome-pool";
import { createBrowserRenderContext } from "@/lib/recipes/render/browser-context";

/**
 * Parse a Cookie header string into individual cookie objects.
 */
function parseCookies(
	cookieHeader: string,
): Array<{ name: string; value: string }> {
	const cookies: Array<{ name: string; value: string }> = [];
	for (const pair of cookieHeader.split(";")) {
		const trimmed = pair.trim();
		if (!trimmed) continue;
		const eqIndex = trimmed.indexOf("=");
		if (eqIndex > 0) {
			cookies.push({
				name: trimmed.substring(0, eqIndex).trim(),
				value: trimmed.substring(eqIndex + 1).trim(),
			});
		}
	}
	return cookies;
}

const COOKIE_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function isLoopbackHost(hostname: string) {
	return (
		hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
	);
}

function buildForwardedCookies(cookieHeader: string, url: URL): CookieData[] {
	const secure = url.protocol === "https:";
	const isLocal = isLoopbackHost(url.hostname);
	return parseCookies(cookieHeader)
		.filter((cookie) => COOKIE_NAME_PATTERN.test(cookie.name))
		.filter(
			(cookie) => secure || isLocal || !cookie.name.startsWith("__Secure-"),
		)
		.filter((cookie) => secure || isLocal || !cookie.name.startsWith("__Host-"))
		.map((cookie) => ({
			name: cookie.name,
			value: cookie.value,
			domain: url.hostname,
			path: "/",
			...(cookie.name.startsWith("__Secure-") ||
			cookie.name.startsWith("__Host-")
				? { secure: true }
				: {}),
		}));
}

async function setForwardedCookies(
	context: { setCookie?: (...cookies: CookieData[]) => Promise<void> },
	cookies: CookieData[],
) {
	if (!context.setCookie || cookies.length === 0) return;

	try {
		await context.setCookie(...cookies);
		return;
	} catch {
		// Some proxy/auth cookies are invalid for the internal render URL.
		// Keep rendering by forwarding only the cookies Chrome accepts.
	}

	for (const cookie of cookies) {
		try {
			await context.setCookie(cookie);
		} catch {
			// Ignore individual cookies that Chrome refuses.
		}
	}
}

/**
 * Render a React recipe by navigating to its preview URL on this Next.js
 * server and capturing a PNG.
 *
 * Each render runs in its own ephemeral browser context (Chrome's incognito
 * equivalent), so cookies set for the caller's session never leak into
 * later renders sharing the pooled Browser. Without this isolation an
 * authenticated render could carry session cookies into an anonymous
 * device-image render fired moments later.
 *
 * Uses the "trusted" Chrome profile — web security is disabled so the preview
 * page can freely reference cross-origin images. This is only safe because
 * the page is our own same-origin Next.js route.
 */
export type RenderWithBrowserOptions = {
	model?: string | null;
	paletteId?: string | null;
	userId?: string | null;
	captureWidth?: number;
	captureHeight?: number;
};

export async function renderWithBrowser(
	slug: string,
	width: number,
	height: number,
	cookies?: string,
	options: RenderWithBrowserOptions = {},
): Promise<Buffer> {
	const port = process.env.PORT || 3000;
	const baseUrl =
		process.env.BROWSER_RENDER_BASE_URL ??
		process.env.NEXT_PUBLIC_BASE_URL ??
		(process.env.NODE_ENV === "production"
			? `http://localhost:${port}`
			: `http://127.0.0.1:${port}`);
	const params = new URLSearchParams({
		width: String(width),
		height: String(height),
	});
	if (options.model) params.set("model", options.model);
	if (options.paletteId) params.set("palette_id", options.paletteId);
	if (options.userId) {
		params.set("render_token", createBrowserRenderContext(options.userId));
	}
	const url = `${baseUrl}/recipes/${slug}/preview?${params.toString()}`;
	const parsedUrl = new URL(url);
	const captureWidth = options.captureWidth ?? width;
	const captureHeight = options.captureHeight ?? height;

	const browser = await getBrowser("trusted");
	const context = await browser.createBrowserContext();
	const page = await context.newPage();

	try {
		if (cookies) {
			const cookiesToSet = buildForwardedCookies(cookies, parsedUrl);
			// Cookies are set on the per-render context — they go away with it.
			await setForwardedCookies(context, cookiesToSet);
		}

		// Force light mode — headless Chrome can default to dark, which breaks
		// Tailwind v4 color tokens that rely on prefers-color-scheme.
		await page.emulateMediaFeatures([
			{ name: "prefers-color-scheme", value: "light" },
		]);
		await page.setViewport({
			width: captureWidth,
			height: captureHeight,
			deviceScaleFactor: 1,
		});
		await page.goto(url, { waitUntil: "domcontentloaded" });
		await page
			.waitForNetworkIdle({ idleTime: 500, timeout: 5000 })
			.catch(() => {
				// Some recipes include slow third-party assets; capture the server-rendered
				// page rather than failing the whole device render.
			});
		const screenshot = await page.screenshot({
			type: "png",
			clip: { x: 0, y: 0, width: captureWidth, height: captureHeight },
		});
		return Buffer.from(screenshot);
	} finally {
		try {
			await page.close();
		} catch {
			// page.close can race with context.close; the latter is the real cleanup.
		}
		try {
			await context.close();
		} catch {
			// If the browser is already gone, the pool will reopen on next call.
		}
	}
}
