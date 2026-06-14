import React from "react";
import { describe, expect, it } from "vitest";
import {
	getResetStyles,
	processDither,
	processGap,
	processResponsive,
} from "./pre-satori-tailwind";

describe("pre-satori Tailwind processing", () => {
	it("selects reset styles for supported HTML elements", () => {
		expect(getResetStyles(React.createElement("h1"))).toContain(
			"text-base font-normal",
		);
		expect(getResetStyles(React.createElement("p"))).toContain("m-0 p-0");
		expect(getResetStyles(React.createElement("div"))).toContain("m-0 p-0");
		expect(getResetStyles(React.createElement("span"))).toContain("m-0 p-0");
		expect(getResetStyles("plain text")).toBe("");
	});

	it("keeps responsive classes untouched when no viewport width is available", () => {
		expect(
			processResponsive("text-sm md:text-lg max-lg:hidden", undefined),
		).toBe("text-sm md:text-lg max-lg:hidden");
		expect(processResponsive(undefined, 800)).toBe("");
	});

	it("activates min and max breakpoint variants for the current viewport", () => {
		expect(
			processResponsive("text-sm md:text-lg lg:text-xl max-lg:hidden", 800),
		).toBe("text-lg hidden");
		expect(
			processResponsive("block sm:hidden max-sm:flex max-md:grid", 500),
		).toBe("grid");
	});

	it("converts Tailwind gap utilities into explicit CSS gap styles", () => {
		expect(processGap("flex gap-2 text-sm")).toEqual({
			style: { gap: "8px" },
			className: "flex text-sm",
		});
		expect(processGap("grid gap-4 gap-x-px")).toEqual({
			style: { columnGap: "1px", rowGap: "16px" },
			className: "grid",
		});
		expect(processGap("grid gap-0 gap-y-1.5")).toEqual({
			style: { rowGap: "6px", columnGap: "0px" },
			className: "grid",
		});
	});

	it("leaves invalid gap tokens as removed gap utilities without style output", () => {
		expect(processGap("grid gap-auto gap-x-loud keep-me")).toEqual({
			style: {},
			className: "grid keep-me",
		});
	});

	it("applies known dither styles and preserves unknown dither classes", () => {
		const known = processDither("dither-500 text-white");

		expect(known.style).toMatchObject({
			backgroundSize: "8px 8px",
			color: "white",
		});
		expect(known.className).toBe("text-white");

		expect(processDither("dither-missing text-black")).toEqual({
			style: {},
			className: "dither-missing text-black",
		});
	});
});
