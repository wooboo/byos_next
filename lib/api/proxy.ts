/**
 * Utility functions for proxying requests to TRMNL API
 */

const TRMNL_API_BASE = "https://usetrmnl.com";
const JSON_HEADERS = {
	"Content-Type": "application/json",
};

export interface ProxyOptions {
	/**
	 * Whether to forward the Authorization header
	 */
	forwardAuth?: boolean;
	/**
	 * Additional headers to include
	 */
	headers?: Record<string, string>;
	/**
	 * Request body (for POST/PATCH requests)
	 */
	body?: unknown;
}

function jsonResponse(data: unknown, status: number): Response {
	return new Response(JSON.stringify(data), {
		status,
		headers: JSON_HEADERS,
	});
}

function trmnlProxyError(error: unknown): Response {
	return jsonResponse(
		{
			error: "Failed to proxy request to TRMNL API",
			message: error instanceof Error ? error.message : "Unknown error",
		},
		502,
	);
}

async function proxyJsonRequest(
	url: string,
	fetchOptions: RequestInit,
): Promise<Response> {
	try {
		const response = await fetch(url, fetchOptions);
		const data = await response.json();

		return jsonResponse(data, response.status);
	} catch (error) {
		return trmnlProxyError(error);
	}
}

/**
 * Proxy a request to the TRMNL API
 */
export async function proxyToTRMNL(
	path: string,
	method: string = "GET",
	request: Request,
	options: ProxyOptions = {},
): Promise<Response> {
	// Preserve query parameters from the original request
	const requestUrl = new URL(request.url);
	const queryString = requestUrl.search;
	const url = `${TRMNL_API_BASE}${path}${queryString}`;

	const headers: HeadersInit = {
		...JSON_HEADERS,
		...options.headers,
	};

	// Forward Authorization header if present and requested
	if (options.forwardAuth) {
		const authHeader = request.headers.get("Authorization");
		if (authHeader) {
			headers.Authorization = authHeader;
		}
	}

	// Forward other relevant headers
	const accessToken = request.headers.get("Access-Token");
	if (accessToken) {
		headers["Access-Token"] = accessToken;
	}

	const fetchOptions: RequestInit = {
		method,
		headers,
	};

	// Add body for POST/PATCH/PUT requests
	if (
		options.body &&
		(method === "POST" || method === "PATCH" || method === "PUT")
	) {
		fetchOptions.body = JSON.stringify(options.body);
	}

	return proxyJsonRequest(url, fetchOptions);
}

/**
 * Proxy a multipart/form-data request (for file uploads)
 */
export async function proxyToTRMNLMultipart(
	path: string,
	request: Request,
	options: ProxyOptions = {},
): Promise<Response> {
	const url = `${TRMNL_API_BASE}${path}`;
	const headers: HeadersInit = {
		...options.headers,
	};

	// Forward Authorization header if present and requested
	if (options.forwardAuth) {
		const authHeader = request.headers.get("Authorization");
		if (authHeader) {
			headers.Authorization = authHeader;
		}
	}

	// Get the form data from the request
	const formData = await request.formData();

	return proxyJsonRequest(url, {
		method: "POST",
		headers,
		body: formData,
	});
}
