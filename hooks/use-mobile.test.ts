import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";

describe("useIsMobile", () => {
	afterEach(() => {
		vi.resetModules();
		vi.doUnmock("react");
	});

	it("subscribes to media query changes and updates mobile state", async () => {
		const setIsMobile = vi.fn();
		let changeHandler: (() => void) | undefined;
		let cleanup: (() => void) | undefined;
		const addEventListener = vi.fn((event: string, listener: () => void) => {
			assert.equal(event, "change");
			changeHandler = listener;
		});
		const removeEventListener = vi.fn((event: string, listener: () => void) => {
			assert.equal(event, "change");
			assert.equal(listener, changeHandler);
		});
		const matchMedia = vi.fn(() => ({
			addEventListener,
			removeEventListener,
		}));

		Object.defineProperty(globalThis, "window", {
			value: {
				innerWidth: 767,
				matchMedia,
			},
			configurable: true,
		});

		vi.doMock("react", async () => {
			const actual = await vi.importActual<typeof import("react")>("react");

			return {
				...actual,
				useEffect: (effect: () => undefined | (() => void)) => {
					const maybeCleanup = effect();
					cleanup =
						typeof maybeCleanup === "function" ? maybeCleanup : undefined;
				},
				useState: () => [undefined, setIsMobile] as const,
			};
		});

		const { useIsMobile } = await import("./use-mobile");
		const result = useIsMobile();

		assert.equal(result, false);
		assert.deepEqual(matchMedia.mock.calls[0], ["(max-width: 767px)"]);
		assert.equal(setIsMobile.mock.calls[0]?.[0], true);

		window.innerWidth = 900;
		changeHandler?.();
		assert.equal(setIsMobile.mock.calls[1]?.[0], false);

		cleanup?.();
		assert.equal(addEventListener.mock.calls.length, 1);
		assert.equal(removeEventListener.mock.calls.length, 1);
	});
});
