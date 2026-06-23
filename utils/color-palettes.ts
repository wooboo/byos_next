import palettes from "@/data/trmnl/palettes.json";
import type { RgbColor, RgbPalette } from "./image-processing";

type TrmnlPalette = {
	id: string;
	colors?: string[];
};

const HEX_COLOR_RE = /^#?[0-9a-f]{6}$/i;

export function parseHexColor(value: string): RgbColor {
	const normalized = value.trim();
	if (!HEX_COLOR_RE.test(normalized)) {
		throw new Error(`Invalid hex color: ${value}`);
	}

	const hex = normalized.replace("#", "");
	return [
		Number.parseInt(hex.slice(0, 2), 16),
		Number.parseInt(hex.slice(2, 4), 16),
		Number.parseInt(hex.slice(4, 6), 16),
	];
}

const paletteData = palettes.data as TrmnlPalette[];

export const NAMED_COLOR_PALETTES: Record<string, RgbPalette> =
	Object.fromEntries(
		paletteData
			.filter((palette) => Array.isArray(palette.colors))
			.map((palette) => [
				palette.id,
				(palette.colors ?? []).map(parseHexColor),
			]),
	);

export function resolveColorPalette(
	value?: string | null,
): RgbPalette | undefined {
	if (!value) return undefined;

	const namedPalette = NAMED_COLOR_PALETTES[value];
	if (namedPalette) return namedPalette;
	if (!value.includes(",") && !HEX_COLOR_RE.test(value.trim()))
		return undefined;

	const colorValues = value
		.split(",")
		.map((color) => color.trim())
		.filter(Boolean);

	if (colorValues.length === 0) return undefined;
	return colorValues.map(parseHexColor);
}
