import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

describe("useSearchWithDebounce", () => {
	afterEach(() => {
		vi.resetModules();
		vi.doUnmock("react");
		vi.useRealTimers();
	});

	async function importHook() {
		vi.doMock("react", async () => {
			const actual = await vi.importActual<typeof import("react")>("react");

			return {
				...actual,
				useCallback: <T extends (...args: Array<unknown>) => unknown>(
					callback: T,
				) => callback,
				useEffect: (effect: () => void) => effect(),
				useRef: <T>(value: T) => ({ current: value }),
			};
		});

		return import("./useSearchWithDebounce");
	}

	it("debounces url updates and resets page for a new search", async () => {
		vi.useFakeTimers();

		const { useSearchWithDebounce } = await importHook();
		const createQueryString = vi.fn(
			(params: Record<string, string | number | null>) =>
				`search=${params.search ?? ""}&page=${params.page}`,
		);
		const router = {
			push: vi.fn(),
		};

		const search = useSearchWithDebounce(
			"alpha",
			3,
			createQueryString,
			"/recipes",
			router,
			250,
		);

		search("beta");
		vi.advanceTimersByTime(249);
		assert.equal(router.push.mock.calls.length, 0);
		vi.advanceTimersByTime(1);

		assert.deepEqual(createQueryString.mock.calls[0]?.[0], {
			search: "beta",
			page: 1,
		});
		assert.deepEqual(router.push.mock.calls[0], [
			"/recipes?search=beta&page=1",
			{ scroll: false },
		]);
	});

	it("preserves the current page when the search term does not change", async () => {
		vi.useFakeTimers();

		const { useSearchWithDebounce } = await importHook();
		const createQueryString = vi.fn(
			(params: Record<string, string | number | null>) =>
				`search=${params.search ?? ""}&page=${params.page}`,
		);
		const router = {
			push: vi.fn(),
		};

		const search = useSearchWithDebounce(
			"alpha",
			3,
			createQueryString,
			"/recipes",
			router,
			100,
		);

		search("alpha");
		vi.advanceTimersByTime(100);

		assert.deepEqual(createQueryString.mock.calls[0]?.[0], {
			search: "alpha",
			page: 3,
		});
		assert.deepEqual(router.push.mock.calls[0], [
			"/recipes?search=alpha&page=3",
			{ scroll: false },
		]);
	});
});
