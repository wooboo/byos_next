import {
	base64ToBinary,
	binaryToBase64,
	binaryToSvgPath,
	parseGridSize,
} from "./bitmap-font-utils";

export interface BitmapFontCharacter {
	charCode: number;
	char: string;
	data: string;
}

export interface BitmapFont {
	width: number;
	height: number;
	characters: BitmapFontCharacter[];
}

export interface PreviewPathItem {
	path: string;
	x: number;
	charCode: number;
	isSelected: boolean;
}

export interface PreviewSvgData {
	width: number;
	height: number;
	paths: PreviewPathItem[];
	charWidth: number;
	charHeight: number;
}

export const buildInitialFontData = (
	fonts: BitmapFont[],
): Record<string, Map<number, string>> => {
	const fontDataObj: Record<string, Map<number, string>> = {};

	for (const font of fonts) {
		const fontSizeKey = `${font.width}x${font.height}`;
		const characterBitmapMap = new Map<number, string>();

		for (const char of font.characters) {
			characterBitmapMap.set(char.charCode, base64ToBinary(char.data));
		}

		fontDataObj[fontSizeKey] = characterBitmapMap;
	}

	return fontDataObj;
};

export const insertGridSize = (
	gridSizes: string[],
	newSize: string,
): string[] => {
	return [...gridSizes, newSize].sort(
		(a, b) => parseGridSize(a)[0] - parseGridSize(b)[0],
	);
};

export const countDefinedCharacters = (
	previewText: string,
	charMap: Map<number, string> | null | undefined,
): number => {
	if (!charMap) return 0;

	return Array.from(previewText).filter(
		(char) => char !== " " && charMap.has(char.charCodeAt(0)),
	).length;
};

export const buildPreviewSvgData = ({
	characterBitmaps,
	selectedGridSize,
	previewText,
	previewScale,
	previewGap,
	selectedCharCode,
	currentCharacterBitmap,
}: {
	characterBitmaps: Map<number, string>;
	selectedGridSize: string;
	previewText: string;
	previewScale: number;
	previewGap: number;
	selectedCharCode: number;
	currentCharacterBitmap: string | null;
}): PreviewSvgData => {
	const [width, height] = parseGridSize(selectedGridSize);
	const charWidth = width * previewScale;
	const charHeight = height * previewScale;
	const spaceWidth = width * previewScale * 0.5;
	const gapWidth = previewGap;
	let totalWidth = 0;
	const paths: PreviewPathItem[] = [];

	for (const char of Array.from(previewText)) {
		const charCode = char.charCodeAt(0);

		if (char === " ") {
			totalWidth += spaceWidth;
			continue;
		}

		const isSelected = charCode === selectedCharCode;
		const binaryString =
			isSelected && currentCharacterBitmap
				? currentCharacterBitmap
				: characterBitmaps.get(charCode);

		if (!binaryString) {
			totalWidth += charWidth;
			continue;
		}

		paths.push({
			path: binaryToSvgPath(binaryString, width, height),
			x: totalWidth,
			charCode,
			isSelected,
		});

		totalWidth += charWidth;
		totalWidth += gapWidth;
	}

	return {
		width: totalWidth,
		height: charHeight,
		paths,
		charWidth,
		charHeight,
	};
};

export const parseUploadedFontData = (fontData: { fonts: BitmapFont[] }) => {
	if (!fontData.fonts || !Array.isArray(fontData.fonts)) {
		throw new Error("Invalid font data format: missing 'fonts' array");
	}

	const fontDataObj: Record<string, Map<number, string>> = {};
	const gridSizes: string[] = [];

	for (const font of fontData.fonts) {
		if (
			typeof font.width !== "number" ||
			typeof font.height !== "number" ||
			!Array.isArray(font.characters)
		) {
			throw new Error("Invalid font data structure");
		}

		const fontSizeKey = `${font.width}x${font.height}`;
		gridSizes.push(fontSizeKey);
		const characterBitmapMap = new Map<number, string>();

		for (const char of font.characters) {
			if (typeof char.charCode !== "number" || typeof char.data !== "string") {
				throw new Error("Invalid character data structure");
			}

			characterBitmapMap.set(char.charCode, base64ToBinary(char.data));
		}

		fontDataObj[fontSizeKey] = characterBitmapMap;
	}

	return { fontDataObj, gridSizes };
};

export const buildFontExportData = ({
	availableGridSizes,
	selectedGridSize,
	fontData,
	characterBitmaps,
	currentCharacterBitmap,
	selectedCharCode,
	now = new Date(),
}: {
	availableGridSizes: string[];
	selectedGridSize: string;
	fontData: Record<string, Map<number, string>>;
	characterBitmaps: Map<number, string>;
	currentCharacterBitmap: string | null;
	selectedCharCode: number;
	now?: Date;
}) => {
	const fontDataToSave = availableGridSizes
		.map((size) => {
			const [width, height] = parseGridSize(size);
			const currentMap =
				size === selectedGridSize
					? new Map(characterBitmaps)
					: new Map(fontData[size] ?? new Map<number, string>());

			if (
				size === selectedGridSize &&
				currentCharacterBitmap &&
				selectedCharCode
			) {
				currentMap.set(selectedCharCode, currentCharacterBitmap);
			}

			return {
				width,
				height,
				characters: Array.from(currentMap.entries())
					.filter(([, binaryString]) => binaryString?.includes("1"))
					.map(([charCode, binaryString]) => ({
						charCode,
						char: String.fromCharCode(charCode),
						data: binaryToBase64(binaryString),
					}))
					.sort((a, b) => a.charCode - b.charCode),
			};
		})
		.filter((font) => font.characters.length > 0);

	const exportData = {
		metadata: {
			name: "Bitmap Font",
			creator: "Bitmap Font Designer",
			createdAt: now.toISOString(),
			version: "1.0",
			description: "Custom bitmap font created with Bitmap Font Designer",
		},
		fonts: fontDataToSave,
	};

	const dateStr = `${now.getFullYear()}-${(now.getMonth() + 1)
		.toString()
		.padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
	const timeStr = `${now.getHours().toString().padStart(2, "0")}${now
		.getMinutes()
		.toString()
		.padStart(2, "0")}`;

	return {
		exportData,
		filename: `bitmap-font-${dateStr}-${timeStr}.json`,
	};
};
