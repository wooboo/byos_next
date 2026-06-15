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

function redactPreviewUrl(url: URL | string) {
	const redacted = new URL(url.toString());
	if (redacted.searchParams.has("access_token")) {
		redacted.searchParams.set("access_token", "[redacted]");
	}
	return redacted.toString();
}

function cookieDiagnostics(cookies: CookieParam[]) {
	return {
		count: cookies.length,
		names: cookies.map((cookie) => cookie.name),
	};
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
	const internalBaseUrl =
		process.env.BROWSER_RENDER_BASE_URL ??
		(process.env.NODE_ENV === "production" ? `http://127.0.0.1:${port}` : null);
	const baseUrl =
		internalBaseUrl ??
		baseUrlOverride ??
		process.env.NEXT_PUBLIC_BASE_URL ??
		`http://127.0.0.1:${port}`;
	const path = previewPath ?? `/preview/recipe/${slug}`;
	const url = new URL(path, baseUrl);
	url.searchParams.set("width", width.toString());
	url.searchParams.set("height", height.toString());
	const renderId = Math.random().toString(36).slice(2, 10);
	const forwardedCookies = cookies ? buildForwardedCookies(cookies, url) : [];

	console.info("[preview-render] browser request", {
		renderId,
		slug,
		size: `${width}x${height}`,
		baseUrl,
		path,
		url: redactPreviewUrl(url),
		hasCookieHeader: Boolean(cookies),
		forwardedCookies: cookieDiagnostics(forwardedCookies),
		nodeEnv: process.env.NODE_ENV,
		port,
	});

	const browser = await getBrowser("trusted");
	const page = await browser.newPage();

	try {
		if (forwardedCookies.length > 0) {
			await setForwardedCookies(page, forwardedCookies);
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
		const response = await page.goto(url.toString(), {
			waitUntil: "networkidle0",
		});
		const finalUrl =
			typeof page.url === "function" ? page.url() : url.toString();
		const title =
			typeof page.title === "function"
				? await page.title().catch(() => null)
				: null;
		console.info("[preview-render] browser response", {
			renderId,
			status: response?.status() ?? null,
			finalUrl: redactPreviewUrl(finalUrl),
			title,
		});
		const screenshot = await page.screenshot({ type: "png" });
		return Buffer.from(screenshot);
	} catch (error) {
		console.error("[preview-render] browser failed", {
			renderId,
			url: redactPreviewUrl(url),
			error,
		});
		throw error;
	} finally {
		await page.close();
	}
}
