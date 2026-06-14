import { afterEach, describe, expect, it, vi } from "vitest";
import { proxyToTRMNL, proxyToTRMNLMultipart } from "./proxy";

describe("proxyToTRMNL", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("forwards query params, auth, access token, and JSON body", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(Response.json({ ok: true }, { status: 201 }));
		const request = new Request("https://byos.example/api?draft=true", {
			headers: {
				Authorization: "Bearer secret",
				"Access-Token": "device-token",
			},
		});

		const response = await proxyToTRMNL("/api/screens", "POST", request, {
			forwardAuth: true,
			headers: { "X-Trace-Id": "trace-1" },
			body: { enabled: true },
		});

		expect(fetchMock).toHaveBeenCalledWith(
			"https://usetrmnl.com/api/screens?draft=true",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer secret",
					"Access-Token": "device-token",
					"X-Trace-Id": "trace-1",
				},
				body: JSON.stringify({ enabled: true }),
			},
		);
		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual({ ok: true });
	});

	it("returns a 502 JSON error when the upstream call fails", async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("boom"));

		const response = await proxyToTRMNL(
			"/api/screens",
			"GET",
			new Request("https://byos.example/api"),
		);

		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toEqual({
			error: "Failed to proxy request to TRMNL API",
			message: "boom",
		});
	});

	it("does not forward auth or stringify bodies for unsupported methods", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(Response.json({ ok: true }));
		const request = new Request("https://byos.example/api", {
			headers: {
				Authorization: "Bearer secret",
			},
		});

		await proxyToTRMNL("/api/screens", "GET", request, {
			body: { ignored: true },
		});

		expect(fetchMock).toHaveBeenCalledWith("https://usetrmnl.com/api/screens", {
			method: "GET",
			headers: {
				"Content-Type": "application/json",
			},
		});
	});

	it("skips the Authorization header when forwarding is enabled but the request has none", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(Response.json({ ok: true }));

		await proxyToTRMNL(
			"/api/screens",
			"PATCH",
			new Request("https://byos.example/api"),
			{
				forwardAuth: true,
				body: { enabled: false },
			},
		);

		expect(fetchMock).toHaveBeenCalledWith("https://usetrmnl.com/api/screens", {
			method: "PATCH",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ enabled: false }),
		});
	});

	it("reports unknown upstream failures without assuming Error instances", async () => {
		vi.spyOn(globalThis, "fetch").mockRejectedValue("network down");

		const response = await proxyToTRMNL(
			"/api/screens",
			"GET",
			new Request("https://byos.example/api"),
		);

		expect(response.status).toBe(502);
		await expect(response.json()).resolves.toMatchObject({
			message: "Unknown error",
		});
	});
});

describe("proxyToTRMNLMultipart", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("forwards multipart form data without forcing JSON headers", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(Response.json({ uploaded: true }));
		const formData = new FormData();
		formData.set(
			"file",
			new Blob(["hello"], { type: "text/plain" }),
			"test.txt",
		);
		const request = new Request("https://byos.example/upload", {
			method: "POST",
			headers: { Authorization: "Bearer secret" },
			body: formData,
		});

		const response = await proxyToTRMNLMultipart("/api/upload", request, {
			forwardAuth: true,
			headers: { "X-Source": "tests" },
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("https://usetrmnl.com/api/upload");
		expect(init).toMatchObject({
			method: "POST",
			headers: {
				Authorization: "Bearer secret",
				"X-Source": "tests",
			},
		});
		expect(init?.body).toBeInstanceOf(FormData);
		await expect(response.json()).resolves.toEqual({ uploaded: true });
	});

	it("omits multipart Authorization when the source request has none", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(Response.json({ uploaded: true }));
		const formData = new FormData();
		formData.set("file", new Blob(["hello"]), "test.txt");
		const request = new Request("https://byos.example/upload", {
			method: "POST",
			body: formData,
		});

		await proxyToTRMNLMultipart("/api/upload", request, {
			forwardAuth: true,
		});

		expect(fetchMock.mock.calls[0]?.[1]?.headers).toEqual({});
	});
});
