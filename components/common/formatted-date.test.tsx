import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormattedDate } from "./formatted-date";

describe("FormattedDate", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("uses a stable SSR fallback date format before hydration", () => {
		const html = renderToStaticMarkup(
			<FormattedDate
				dateString="2026-03-05T12:30:00.000Z"
				className="date-stamp"
			/>,
		);

		assert.match(html, /class="date-stamp"/);
		assert.match(html, />03\/05\/2026</);
	});

	it("runs the mount effect and formats the client date with provided options", async () => {
		const setFormattedDate = vi.fn();
		const setIsMounted = vi.fn();

		vi.resetModules();
		vi.doMock("react", async () => {
			const actual = await vi.importActual<typeof React>("react");
			let stateCallIndex = 0;

			return {
				...actual,
				useEffect: (effect: () => void) => {
					effect();
				},
				useState: <T,>(initialValue: T) => {
					stateCallIndex += 1;
					return stateCallIndex === 1
						? [initialValue, setFormattedDate]
						: [initialValue, setIsMounted];
				},
			};
		});

		const localeSpy = vi
			.spyOn(Date.prototype, "toLocaleDateString")
			.mockReturnValue("March 5, 2026");

		const { FormattedDate: ReloadedFormattedDate } = await import(
			"./formatted-date"
		);

		renderToStaticMarkup(
			<ReloadedFormattedDate
				dateString="2026-03-05T12:30:00.000Z"
				options={{ month: "long", day: "numeric", year: "numeric" }}
			/>,
		);

		expect(setIsMounted).toHaveBeenCalledWith(true);
		expect(setFormattedDate).toHaveBeenCalledWith("March 5, 2026");
		expect(localeSpy).toHaveBeenCalledWith(undefined, {
			month: "long",
			day: "numeric",
			year: "numeric",
		});

		vi.doUnmock("react");
		vi.resetModules();
	});
});
