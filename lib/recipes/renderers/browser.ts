import type { CookieParam } from "puppeteer-core";
import { getBrowser } from "@/lib/recipes/chrome-pool";

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

function buildForwardedCookies(cookieHeader: string, url: URL): CookieParam[] {
	const secure = url.protocol === "https:";
	const isLocalhost = url.hostname === "localhost";
	return parseCookies(cookieHeader)
		.filter((cookie) => COOKIE_NAME_PATTERN.test(cookie.name))
		.filter(
			(cookie) => secure || isLocalhost || !cookie.name.startsWith("__Secure-"),
		)
		.filter(
			(cookie) => secure || isLocalhost || !cookie.name.startsWith("__Host-"),
		)
		.map((cookie) => ({
			name: cookie.name,
			value: cookie.value,
			url: url.origin,
			...(cookie.name.startsWith("__Secure-") ||
			cookie.name.startsWith("__Host-")
				? { secure: true }
				: {}),
			...(cookie.name.startsWith("__Host-") ? { path: "/" } : {}),
		}));
}

async function setForwardedCookies(
	page: { setCookie?: (...cookies: CookieParam[]) => Promise<void> },
	cookies: CookieParam[],
) {
	if (!page.setCookie || cookies.length === 0) return;

	try {
		await page.setCookie(...cookies);
		return;
	} catch {
		// Some proxy/auth cookies are invalid for the internal render URL.
		// Keep rendering by forwarding only the cookies Chrome accepts.
	}

	for (const cookie of cookies) {
		try {
			await page.setCookie(cookie);
		} catch {
			// Ignore individual cookies that Chrome refuses.
		}
	}
}

/**
 * Render a React recipe by navigating to its preview URL on this Next.js
 * server and capturing a PNG.
 *
 * Uses the "trusted" Chrome profile — web security is disabled so the preview
 * page can freely reference cross-origin images. This is only safe because
 * the page is our own same-origin Next.js route.
 */
export async function renderWithBrowser(
	slug: string,
	width: number,
	height: number,
	cookies?: string,
	previewPath?: string,
	baseUrlOverride?: string,
): Promise<Buffer> {
	const port = process.env.PORT || 3001;
	const baseUrl =
		baseUrlOverride ??
		process.env.NEXT_PUBLIC_BASE_URL ??
		`http://127.0.0.1:${port}`;
	const path = previewPath ?? `/preview/recipe/${slug}`;
	const url = new URL(path, baseUrl);
	url.searchParams.set("width", width.toString());
	url.searchParams.set("height", height.toString());

	const browser = await getBrowser("trusted");
	const page = await browser.newPage();

	try {
		if (cookies) {
			await setForwardedCookies(page, buildForwardedCookies(cookies, url));
		}

		// Force light mode — headless Chrome can default to dark, which breaks
		// Tailwind v4 color tokens that rely on prefers-color-scheme.
		await page.emulateMediaFeatures([
			{ name: "prefers-color-scheme", value: "light" },
		]);
		await page.setViewport({
			width,
			height,
			deviceScaleFactor: 1,
		});
		await page.goto(url.toString(), { waitUntil: "networkidle0" });
		const screenshot = await page.screenshot({ type: "png" });
		return Buffer.from(screenshot);
	} finally {
		await page.close();
	}
}
