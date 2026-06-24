import palettes from "@/data/trmnl/palettes.json";
import type { RgbColor, RgbPalette } from "./image-processing";

type TrmnlPalette = {
	id: string;
	colors?: string[];
	observed_colors?: string[];
};

const HEX_COLOR_RE = /^#?[0-9a-f]{6}$/i;

export type ColorPaletteProfile = {
	colors: RgbPalette;
	ditherColors: RgbPalette;
	previewColors: RgbPalette;
};

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

function parseColorList(values: readonly string[]): RgbPalette {
	return values.map(parseHexColor);
}

function resolveObservedColors(palette: TrmnlPalette, colors: RgbPalette) {
	if (!palette.observed_colors) return colors;

	const observedColors = parseColorList(palette.observed_colors);
	return observedColors.length === colors.length ? observedColors : colors;
}

export const NAMED_COLOR_PALETTE_PROFILES: Record<string, ColorPaletteProfile> =
	Object.fromEntries(
		paletteData
			.filter((palette) => Array.isArray(palette.colors))
			.map((palette) => {
				const colors = parseColorList(palette.colors ?? []);
				const observedColors = resolveObservedColors(palette, colors);

				return [
					palette.id,
					{
						colors,
						ditherColors: observedColors,
						previewColors: observedColors,
					},
				];
			}),
	);

export const NAMED_COLOR_PALETTES: Record<string, RgbPalette> =
	Object.fromEntries(
		Object.entries(NAMED_COLOR_PALETTE_PROFILES).map(([id, profile]) => [
			id,
			profile.colors,
		]),
	);

export function resolveColorPaletteProfile(
	value?: string | null,
): ColorPaletteProfile | undefined {
	if (!value) return undefined;

	const namedPalette = NAMED_COLOR_PALETTE_PROFILES[value];
	if (namedPalette) return namedPalette;
	if (!value.includes(",") && !HEX_COLOR_RE.test(value.trim()))
		return undefined;

	const colorValues = value
		.split(",")
		.map((color) => color.trim())
		.filter(Boolean);

	if (colorValues.length === 0) return undefined;
	const colors = parseColorList(colorValues);
	return {
		colors,
		ditherColors: colors,
		previewColors: colors,
	};
}

export function resolveColorPalette(
	value?: string | null,
): RgbPalette | undefined {
	return resolveColorPaletteProfile(value)?.colors;
}
