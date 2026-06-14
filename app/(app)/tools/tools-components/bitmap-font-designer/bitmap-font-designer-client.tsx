"use client";

import { Download, Info, Upload } from "lucide-react";
import {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import { toast } from "sonner";
import bitmapFontFile from "@/components/bitmap-font/bitmap-font.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import AddGridSize from "./add-grid-size";
import {
	type BitmapFont,
	buildFontExportData,
	buildInitialFontData,
	buildPreviewSvgData,
	countDefinedCharacters,
	insertGridSize,
	parseUploadedFontData,
} from "./bitmap-font-designer-helpers";
import BitmapFontEditor from "./bitmap-font-editor";
import { binaryToSvgPath, parseGridSize } from "./bitmap-font-utils";

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedValue(value);
		}, delay);

		return () => {
			clearTimeout(timer);
		};
	}, [value, delay]);

	return debouncedValue;
}

const bitmapFont = bitmapFontFile.fonts;

// Basic ASCII (32-126)
export const basicAsciiSet = Array.from({ length: 95 }, (_, i) => ({
	charCode: i + 32,
}));

// Latin-1 Supplement (only useful printable range)
const commonLatin1 = [
	160, // Non-breaking space
	161,
	162,
	163,
	165,
	166,
	167,
	169, // ¡ ¢ £ ¥ ¦ § ©
	171,
	172,
	174,
	176,
	177,
	181,
	182,
	183, // « ¬ ® ° ± µ ¶ ·
	187,
	188,
	189,
	190, // » ¼ ½ ¾
	192,
	193,
	194,
	195,
	196,
	197,
	198,
	199,
	200,
	201,
	202,
	203,
	210,
	211,
	212,
	213,
	214,
	216,
	217,
	218,
	219,
	220,
	223, // ß
	224,
	225,
	226,
	227,
	228,
	229,
	230,
	231,
	232,
	233,
	234,
	235,
	241,
	242,
	243,
	244,
	245,
	246,
	248,
	249,
	250,
	251,
	252,
	253,
	255,
];
export const latin1Set = commonLatin1.map((charCode) => ({ charCode }));

// Greek (subset for scientific symbols)
const commonGreek = [
	913,
	914,
	915,
	916,
	920,
	923,
	926,
	928,
	931,
	934,
	936,
	937, // capitals
	945,
	946,
	947,
	948,
	949,
	950,
	951,
	952,
	955,
	960,
	961,
	964,
	965,
	966,
	967,
	968,
	969, // lower
];
export const greekSet = commonGreek.map((charCode) => ({ charCode }));

// Cyrillic (1024-1279)
export const cyrillicSet = Array.from({ length: 256 }, (_, i) => ({
	charCode: i + 1024,
}));

// Symbols and Emojis
const commonSymbols = [
	// Smart quotes
	8211, // – en dash
	8212, // — em dash
	8216, // ‘ left single quotation
	8217, // ’ right single quotation ← U+2019, your priority
	8220, // “ left double quotation
	8221, // ” right double quotation
	8230, // … ellipsis
	8226, // • bullet
	8242,
	8243, // ′ ″ (prime and double prime)
	8250, // ›

	// Arrows (U+2190–U+21FF)
	...Array.from({ length: 96 }, (_, i) => 0x2190 + i), // ← to ⇿

	// Common UI symbols
	10003, // ✓
	10005, // ✗
	9733,
	9734, // ★ ☆
	9745, // ☑
	9755,
	9757, // ☛ ☝
	9786, // ☺
	9829, // ♥
	9888, // ⚠
];
export const symbolsSet = commonSymbols.map((charCode) => ({ charCode }));

// generate all char codes in Basic ASCII, Latin-1, Greek, Cyrillic, Symbols
const charCodesGroups = [
	{ name: "Basic ASCII", charCodes: basicAsciiSet },
	{ name: "Latin-1 Supplement", charCodes: latin1Set },
	{ name: "Greek and Coptic", charCodes: greekSet },
	{ name: "Cyrillic", charCodes: cyrillicSet },
	{ name: "Symbols and Pictographs", charCodes: symbolsSet },
];

// Constants for grid layout
const ITEM_WIDTH = 40;
const ITEM_HEIGHT = 60;

// Create a flat array of all characters
const allCharacters = charCodesGroups.flatMap((group) => group.charCodes);

interface Character {
	charCode: number;
}

// Combined CharacterItem component with BinaryToSvg functionality
const CharacterItem = memo(
	({
		charCode,
		charData,
		onCharacterClick,
		selectedGridSize,
		isSelected = false,
	}: {
		charCode: number;
		charData: string;
		onCharacterClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
		selectedGridSize: string;
		isSelected?: boolean;
	}) => {
		const [width, height] = parseGridSize(selectedGridSize);

		// Render SVG content inline instead of using a separate component
		const renderSvgContent = () => {
			if (!charData && charCode !== 32) {
				return (
					<div className="size-5 border border-border border-dashed flex items-center justify-center">
						{String.fromCharCode(charCode)}
					</div>
				);
			}

			try {
				// Create a single path element instead of multiple rects
				const pathData = binaryToSvgPath(charData, width, height);

				return (
					<svg
						className="w-full h-full dark:invert border-[0.5px] border-border"
						width={width}
						height={height}
						viewBox={`0 0 ${width} ${height}`}
						role="img"
						aria-label={`Character ${String.fromCharCode(charCode)} bitmap`}
					>
						<path d={pathData} fill="black" />
					</svg>
				);
			} catch (error) {
				console.error("Error processing binary:", error);
				return (
					<div className="size-5 border border-border border-dashed flex items-center justify-center text-xs">
						?
					</div>
				);
			}
		};

		return (
			<button
				type="button"
				className={cn(
					"flex flex-col items-center justify-between border p-1 hover:bg-muted cursor-pointer",
					isSelected && "bg-primary/10 border-primary",
				)}
				style={{
					width: `${ITEM_WIDTH}px`,
					height: `${ITEM_HEIGHT}px`,
					padding: "4px",
				}}
				onClick={onCharacterClick}
				data-char-code={charCode}
				aria-label={`Character ${String.fromCharCode(charCode)}`}
			>
				<span className="text-sm mb-1 font-mono">
					{String.fromCharCode(charCode)}
				</span>
				<div className="flex-1 flex items-center justify-center">
					{renderSvgContent()}
				</div>
			</button>
		);
	},
	(prevProps, nextProps) => {
		return (
			prevProps.selectedGridSize === nextProps.selectedGridSize &&
			prevProps.isSelected === nextProps.isSelected &&
			prevProps.charCode === nextProps.charCode &&
			prevProps.charData === nextProps.charData
		);
	},
);

CharacterItem.displayName = "CharacterItem";

const CharacterGrid = ({
	selectedGridSize,
	onCharacterSelect,
	selectedCharCode,
	characterBitmaps,
	currentCharacterBitmap,
}: {
	selectedGridSize: string;
	onCharacterSelect: (charCode: string) => void;
	selectedCharCode: number;
	characterBitmaps: Map<number, string>;
	currentCharacterBitmap: string | null;
}) => {
	const containerRef = useRef<HTMLDivElement>(null);

	// Scroll to selected character when it changes
	useEffect(() => {
		if (!containerRef.current || !selectedCharCode) return;

		const selectedElement = containerRef.current.querySelector(
			`[data-char-code="${selectedCharCode}"]`,
		);
		if (selectedElement) {
			selectedElement.scrollIntoView({
				behavior: "smooth",
				block: "nearest",
			});
		}
	}, [selectedCharCode]);

	const handleCharacterClick = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			const charCode = e.currentTarget.dataset.charCode;
			if (!charCode) return;
			onCharacterSelect(charCode);
		},
		[onCharacterSelect],
	);

	return (
		<div
			ref={containerRef}
			className="w-full overflow-auto border border-border rounded-md p-2 h-[32vh]"
		>
			<div className="flex flex-wrap gap-1 p-1">
				{allCharacters.map((char: Character) =>
					char.charCode === selectedCharCode ? (
						<CharacterItem
							key={char.charCode}
							charCode={char.charCode}
							onCharacterClick={handleCharacterClick}
							charData={currentCharacterBitmap ?? ""}
							selectedGridSize={selectedGridSize}
							isSelected={true}
						/>
					) : (
						<CharacterItem
							key={char.charCode}
							charCode={char.charCode}
							onCharacterClick={handleCharacterClick}
							charData={characterBitmaps.get(char.charCode) ?? ""}
							selectedGridSize={selectedGridSize}
						/>
					),
				)}
			</div>
		</div>
	);
};

CharacterGrid.displayName = "CharacterGrid";

// Preview sentence component memoized to avoid unnecessary re-renders - stateless version
const SentencePreview = memo(
	({
		characterBitmaps,
		selectedGridSize,
		previewText,
		previewScale,
		previewGap,
		selectedCharCode,
		currentCharacterBitmap,
		onPreviewTextChange,
		onPreviewScaleChange,
		onPreviewGapChange,
	}: {
		characterBitmaps: Map<number, string>;
		selectedGridSize: string;
		previewText: string;
		previewScale: number;
		previewGap: number;
		selectedCharCode: number;
		currentCharacterBitmap: string | null;
		onPreviewTextChange: (newPreviewText: string) => void;
		onPreviewScaleChange: (newScale: number) => void;
		onPreviewGapChange: (newGap: number) => void;
	}) => {
		const charMap = characterBitmaps;
		const uniqueChars = new Set(Array.from(previewText)).size;

		// State for the input field to prevent jank during typing
		const [inputValue, setInputValue] = useState(previewText);

		// Update local input state when previewText prop changes
		useEffect(() => {
			setInputValue(previewText);
		}, [previewText]);

		// Debounce the input to avoid performance issues when typing quickly
		const debouncedInputValue = useDebounce(inputValue, 300);

		// Update the parent state when debounced value changes
		useEffect(() => {
			if (debouncedInputValue !== previewText) {
				onPreviewTextChange(debouncedInputValue);
			}
		}, [debouncedInputValue, onPreviewTextChange, previewText]);

		const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			setInputValue(e.target.value);
		};

		const handleScaleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			onPreviewScaleChange(parseFloat(e.target.value));
		};

		const handleGapChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			onPreviewGapChange(parseInt(e.target.value, 10));
		};

		// Count how many characters have bitmap data defined
		const definedChars = useMemo(
			() => countDefinedCharacters(previewText, charMap),
			[previewText, charMap],
		);

		const svgData = useMemo(
			() =>
				buildPreviewSvgData({
					characterBitmaps: charMap,
					selectedGridSize,
					previewText,
					previewScale,
					previewGap,
					selectedCharCode,
					currentCharacterBitmap,
				}),
			[
				charMap,
				selectedGridSize,
				previewText,
				previewScale,
				previewGap,
				selectedCharCode,
				currentCharacterBitmap,
			],
		);

		return (
			<div className="w-full overflow-hidden rounded-2xl border bg-card">
				<div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
					<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
						Preview
					</h3>
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									type="button"
									className="inline-flex items-center text-muted-foreground hover:text-foreground"
								>
									<Info className="h-3.5 w-3.5" />
								</button>
							</TooltipTrigger>
							<TooltipContent>
								<p>
									Characters with defined bitmap data: {definedChars} /{" "}
									{previewText.length - previewText.split(" ").length + 1}
								</p>
								<p>Preview of how the bitmap font renders text</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>

				<div className="space-y-3 p-4">
					<Input
						type="text"
						value={inputValue}
						onChange={handleInputChange}
						placeholder="Type a custom preview sentence…"
						className="w-full"
						aria-label="Preview sentence"
					/>

					<div className="flex flex-wrap items-center justify-end gap-4 text-sm">
						<div className="flex items-center gap-2">
							<label
								htmlFor="preview-scale"
								className="text-xs whitespace-nowrap"
							>
								Scale:
							</label>
							<input
								id="preview-scale"
								type="range"
								min="1"
								max="3"
								step="0.25"
								value={previewScale}
								onChange={handleScaleChange}
								className="w-24 accent-primary"
							/>
							<span className="text-xs">{previewScale.toFixed(2)}x</span>
						</div>
						<div className="flex items-center gap-2">
							<label
								htmlFor="preview-gap"
								className="text-xs whitespace-nowrap"
							>
								Gap:
							</label>
							<input
								id="preview-gap"
								type="range"
								min="0"
								max="5"
								step="1"
								value={previewGap}
								onChange={handleGapChange}
								className="w-24 accent-primary"
							/>
							<span className="text-xs">{previewGap}px</span>
						</div>
					</div>

					<div className="overflow-x-auto rounded-md border bg-muted/20 p-3">
						<svg
							width={svgData.width}
							height={svgData.height}
							viewBox={`0 0 ${svgData.width} ${svgData.height}`}
							className="dark:invert"
							role="img"
							aria-label="Font preview"
						>
							{svgData.paths.map((item, index) => (
								<g
									key={index}
									transform={`translate(${item.x}, 0) scale(${previewScale})`}
								>
									<path d={item.path} fill={"black"} />
								</g>
							))}
						</svg>
					</div>
				</div>
				<div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
					<span>Font size: {selectedGridSize}</span>
					<span className="tabular-nums">
						{previewText.length} characters · {uniqueChars} unique
					</span>
				</div>
			</div>
		);
	},
	(prevProps, nextProps) => {
		// Custom comparison to avoid unnecessary re-renders
		// Only re-render if these specific props change
		return (
			prevProps.selectedGridSize === nextProps.selectedGridSize &&
			prevProps.previewText === nextProps.previewText &&
			prevProps.previewScale === nextProps.previewScale &&
			prevProps.previewGap === nextProps.previewGap &&
			prevProps.selectedCharCode === nextProps.selectedCharCode &&
			prevProps.currentCharacterBitmap === nextProps.currentCharacterBitmap
		);
	},
);

SentencePreview.displayName = "SentencePreview";

// Component for loading font data from file
const FontFileLoader = memo(
	({
		onLoadFont,
	}: {
		onLoadFont: (fontData: { fonts: BitmapFont[] }) => void;
	}) => {
		const fileInputRef = useRef<HTMLInputElement>(null);

		const handleClick = () => {
			if (fileInputRef.current) {
				fileInputRef.current.click();
			}
		};

		const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			const reader = new FileReader();
			reader.onload = (event) => {
				try {
					const jsonData = JSON.parse(event.target?.result as string);
					onLoadFont(jsonData);

					// Reset the input so the same file can be uploaded again
					if (fileInputRef.current) {
						fileInputRef.current.value = "";
					}
				} catch (error) {
					console.error("Error parsing JSON font file:", error);
					alert("Invalid font file format. Please upload a valid JSON file.");
				}
			};
			reader.readAsText(file);
		};

		return (
			<div>
				<input
					type="file"
					ref={fileInputRef}
					accept=".json"
					onChange={handleFileChange}
					className="hidden"
					aria-label="Load font file"
				/>
				<Button
					onClick={handleClick}
					variant="outline"
					size="sm"
					className="flex items-center gap-1"
				>
					<Upload className="w-4 h-4" />
					<span>Load Font</span>
				</Button>
			</div>
		);
	},
	() => true,
); // Always consider equal to prevent unnecessary re-renders

FontFileLoader.displayName = "FontFileLoader";

export default function BitmapFontDesignerClient() {
	// Process and organize font data into a structured map for efficient access
	// Format: { "8x8": Map(65 => "10101010..."), "16x16": Map(65 => "10101010..."), ... }
	const initialFontDataObj = useMemo(
		() => buildInitialFontData(bitmapFont),
		[],
	);

	// Create a ref to store the font data to avoid dependency issues in callbacks
	const fontDataRef = useRef(initialFontDataObj);
	// Keep the ref updated with the initial value
	fontDataRef.current = initialFontDataObj;

	// Available grid sizes extracted from the font data (e.g., ["8x8", "16x16"])
	const [availableGridSizes, setAvailableGridSizes] = useState(
		bitmapFont.map((font) => `${font.width}x${font.height}`),
	);

	// Currently selected grid size (e.g., "8x8")
	const [selectedGridSize, setSelectedGridSize] = useState<string>("7x8");

	// Currently selected character (default: 'A' which has charCode 65)
	const [selectedCharCode, setSelectedCharCode] = useState<number>(65);

	// Text used for previewing the font
	const [previewText, setPreviewText] = useState(
		"Hello World! The quick brown fox jumps over the lazy dog.",
	);

	// Preview display settings
	const [previewScale, setPreviewScale] = useState(2); // Size multiplier
	const [previewGap, setPreviewGap] = useState(0); // Space between characters

	// Map of all character bitmap data for the current grid size
	const [characterBitmaps, setCharacterBitmaps] = useState<Map<number, string>>(
		initialFontDataObj[selectedGridSize] ?? new Map(),
	);

	// Bitmap data for the currently selected character
	const [currentCharacterBitmap, setCurrentCharacterBitmap] = useState<
		string | null
	>(characterBitmaps.get(selectedCharCode) ?? null);

	const [, startTransition] = useTransition();

	// Handle adding a new grid size
	const handleAddSize = useCallback((newSize: string) => {
		// Create a new entry in the initialFontDataObj for this size
		if (!fontDataRef.current[newSize]) {
			fontDataRef.current[newSize] = new Map<number, string>();
		}

		// Update the availableGridSizes list
		setAvailableGridSizes((prev) => {
			return insertGridSize(prev, newSize);
		});

		// Switch to the new grid size
		setSelectedGridSize(newSize);

		// Update character bitmaps for the new size
		setCharacterBitmaps(fontDataRef.current[newSize]);

		// Update current character bitmap
		setCurrentCharacterBitmap(null);
	}, []);

	const handleDataChange = useCallback(
		(newBinaryData: string, charCode: number) => {
			// Update state for rerender, then update global data non-blockingly using useTransition
			startTransition(() => {
				// Update both the maps and current character data
				characterBitmaps.set(charCode, newBinaryData);

				// Ensure the map exists before trying to set a value on it
				if (!fontDataRef.current[selectedGridSize]) {
					fontDataRef.current[selectedGridSize] = new Map<number, string>();
				}

				fontDataRef.current[selectedGridSize].set(charCode, newBinaryData);

				// If this is the currently selected character, update its bitmap too
				if (charCode === selectedCharCode) {
					setCurrentCharacterBitmap(newBinaryData);
				}
			});
		},
		[selectedGridSize, selectedCharCode, characterBitmaps],
	);

	const handleSizeChange = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			const size = e.currentTarget.dataset.size;
			if (!size) return;

			// Update grid size
			setSelectedGridSize(size);

			// Ensure the font data object has an entry for this size
			if (!fontDataRef.current[size]) {
				fontDataRef.current[size] = new Map<number, string>();
			}

			// Get the character maps for this size
			const newCharacterBitmaps = fontDataRef.current[size] ?? new Map();
			setCharacterBitmaps(newCharacterBitmaps);

			// Update the current character bitmap for the selected character in the new size
			setCurrentCharacterBitmap(
				newCharacterBitmaps.get(selectedCharCode) ?? null,
			);
		},
		[selectedCharCode],
	);

	const handleCharacterSelect = useCallback(
		(charCode: string) => {
			const newCharCode = parseInt(charCode, 10);
			setSelectedCharCode(newCharCode);
			// Update the current character bitmap when selecting a new character
			setCurrentCharacterBitmap(characterBitmaps.get(newCharCode) ?? null);
		},
		[characterBitmaps],
	);

	const handlePreviewTextChange = useCallback((newPreviewText: string) => {
		setPreviewText(newPreviewText);
	}, []);

	const handlePreviewScaleChange = useCallback((newScale: number) => {
		setPreviewScale(newScale);
	}, []);

	const handlePreviewGapChange = useCallback((newGap: number) => {
		setPreviewGap(newGap);
	}, []);

	// Function to load font data from uploaded JSON file
	const loadFontData = useCallback(
		(fontData: { fonts: BitmapFont[] }) => {
			try {
				const { fontDataObj: newFontDataObj, gridSizes: newGridSizes } =
					parseUploadedFontData(fontData);

				// Replace the initialFontDataObj with the new data
				Object.keys(fontDataRef.current).forEach((key) => {
					delete fontDataRef.current[key];
				});

				// Copy new data to initialFontDataObj
				Object.keys(newFontDataObj).forEach((key) => {
					fontDataRef.current[key] = newFontDataObj[key];
				});

				// Update application state
				setAvailableGridSizes(newGridSizes);

				// Set the first font size as selected if available, otherwise keep current
				if (newGridSizes.length > 0) {
					const firstSize = newGridSizes[0];
					setSelectedGridSize(firstSize);

					// Update character bitmaps for the new selected size
					const newCharacterBitmaps =
						fontDataRef.current[firstSize] ?? new Map();
					setCharacterBitmaps(newCharacterBitmaps);

					// Update current character bitmap
					setCurrentCharacterBitmap(
						newCharacterBitmaps.get(selectedCharCode) ?? null,
					);
				}

				// Show success notification
				toast.success("Font data loaded successfully!");
			} catch (error) {
				console.error("Error loading font data:", error);
				toast.error(
					`Failed to load font data: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			}
		},
		[selectedCharCode],
	);

	// Function to save the font data to JSON
	const saveFontData = useCallback(() => {
		const { exportData, filename } = buildFontExportData({
			availableGridSizes,
			selectedGridSize,
			fontData: fontDataRef.current,
			characterBitmaps,
			currentCharacterBitmap,
			selectedCharCode,
		});
		const jsonData = JSON.stringify(exportData, null, 2);

		// Create a download link for the data
		const blob = new Blob([jsonData], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();

		// Clean up
		setTimeout(() => {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, 0);
	}, [
		availableGridSizes,
		selectedGridSize,
		characterBitmaps,
		currentCharacterBitmap,
		selectedCharCode,
	]);

	return (
		<div className="w-full flex flex-col gap-4">
			<div className="flex flex-wrap gap-2 mb-4 justify-between">
				<div className="flex flex-wrap gap-2">
					{availableGridSizes.map((size) => (
						<Button
							key={size}
							variant="outline"
							className={cn(
								selectedGridSize === size && "bg-primary hover:bg-primary/90",
							)}
							onClick={handleSizeChange}
							data-size={size}
							size="sm"
						>
							{size}
						</Button>
					))}
					<AddGridSize
						availableGridSizes={availableGridSizes}
						onAddSize={handleAddSize}
					/>
				</div>
				<div className="flex gap-2">
					<FontFileLoader onLoadFont={loadFontData} />
					<Button
						onClick={saveFontData}
						variant="outline"
						size="sm"
						className="flex items-center gap-1"
						title="Save font data"
					>
						<Download className="w-4 h-4" />
						<span>Save Font</span>
					</Button>
				</div>
			</div>

			<CharacterGrid
				selectedGridSize={selectedGridSize}
				onCharacterSelect={handleCharacterSelect}
				selectedCharCode={selectedCharCode}
				characterBitmaps={characterBitmaps}
				currentCharacterBitmap={currentCharacterBitmap}
			/>

			<div className="space-y-2">
				<SentencePreview
					characterBitmaps={characterBitmaps}
					selectedGridSize={selectedGridSize}
					previewText={previewText}
					previewScale={previewScale}
					previewGap={previewGap}
					selectedCharCode={selectedCharCode}
					currentCharacterBitmap={currentCharacterBitmap}
					onPreviewTextChange={handlePreviewTextChange}
					onPreviewScaleChange={handlePreviewScaleChange}
					onPreviewGapChange={handlePreviewGapChange}
				/>
			</div>

			<div className="w-full">
				<BitmapFontEditor
					selectedGridSize={selectedGridSize}
					selectedCharCode={selectedCharCode}
					currentCharacterBitmap={currentCharacterBitmap ?? ""}
					setCurrentCharacterBitmap={setCurrentCharacterBitmap}
					onDataChange={handleDataChange}
				/>
			</div>
		</div>
	);
}
