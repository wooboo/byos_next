import type { NextRequest } from "next/server";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export async function GET(req: NextRequest) {
	const rawUrl = new URL(req.url).searchParams.get("url");
	if (!rawUrl) return new Response("Missing url", { status: 400 });

	let url: URL;
	try {
		url = new URL(rawUrl);
	} catch {
		return new Response("Invalid url", { status: 400 });
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		return new Response("Unsupported url", { status: 400 });
	}

	const upstream = await fetch(url, {
		headers: {
			Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
			"User-Agent": "TRMNL-BYOS image proxy",
		},
	});

	if (!upstream.ok || !upstream.body) {
		return new Response("Failed to fetch image", { status: 502 });
	}

	const contentType = upstream.headers.get("content-type") ?? "";
	if (!contentType.toLowerCase().startsWith("image/")) {
		return new Response("URL did not return an image", { status: 415 });
	}

	const contentLength = Number.parseInt(
		upstream.headers.get("content-length") ?? "",
		10,
	);
	if (contentLength > MAX_IMAGE_BYTES) {
		return new Response("Image too large", { status: 413 });
	}

	const bytes = Buffer.from(await upstream.arrayBuffer());
	if (bytes.length > MAX_IMAGE_BYTES) {
		return new Response("Image too large", { status: 413 });
	}

	return new Response(new Uint8Array(bytes), {
		headers: {
			"Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
			"Content-Length": bytes.length.toString(),
			"Content-Type": contentType,
		},
	});
}
