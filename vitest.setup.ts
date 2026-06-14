import { vi } from "vitest";

const createFont = (className: string) =>
	vi.fn(({ variable }: { variable?: string } = {}) => ({
		className,
		style: {},
		variable: variable ?? "",
	}));

vi.mock("next/font/google", () => ({
	Geist: createFont("font-sans"),
	Geist_Mono: createFont("font-mono"),
}));

vi.mock("next/font/local", () => ({
	default: createFont("font-local"),
}));
