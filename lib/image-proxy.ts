export function proxiedImageUrl(imageUrl: string) {
	if (
		imageUrl.startsWith("/") ||
		imageUrl.startsWith("data:") ||
		imageUrl.startsWith("blob:")
	) {
		return imageUrl;
	}

	try {
		const url = new URL(imageUrl);
		if (url.protocol !== "http:" && url.protocol !== "https:") return imageUrl;
		return `/api/image-proxy?url=${encodeURIComponent(url.toString())}`;
	} catch {
		return imageUrl;
	}
}
