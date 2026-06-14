import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("app/api/image-proxy GET", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("returns proxied image bytes", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				body: {},
				headers: new Headers({
					"content-length": "3",
					"content-type": "image/png",
				}),
				arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
			})),
		);

		const response = await GET(
			new Request(
				"https://example.test/api/image-proxy?url=https%3A%2F%2Fimages.example%2Fa.png",
			) as never,
		);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(Buffer.from(await response.arrayBuffer())).toEqual(
			Buffer.from([1, 2, 3]),
		);
		expect(fetch).toHaveBeenCalledWith(
			new URL("https://images.example/a.png"),
			expect.objectContaining({
				headers: expect.objectContaining({
					Accept: expect.stringContaining("image/"),
				}),
			}),
		);
	});

	it("rejects missing, non-http, and non-image URLs", async () => {
		await expect(
			GET(new Request("https://example.test/api/image-proxy") as never),
		).resolves.toMatchObject({ status: 400 });

		await expect(
			GET(
				new Request(
					"https://example.test/api/image-proxy?url=file%3A%2F%2Ftmp%2Fa.png",
				) as never,
			),
		).resolves.toMatchObject({ status: 400 });

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				body: {},
				headers: new Headers({ "content-type": "text/html" }),
				arrayBuffer: async () => new Uint8Array([1]).buffer,
			})),
		);

		await expect(
			GET(
				new Request(
					"https://example.test/api/image-proxy?url=https%3A%2F%2Fexample.com%2F",
				) as never,
			),
		).resolves.toMatchObject({ status: 415 });
	});
});
