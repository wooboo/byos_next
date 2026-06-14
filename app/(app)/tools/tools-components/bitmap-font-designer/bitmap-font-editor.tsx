"use client";

import {
	ArrowDown,
	ArrowLeft,
	ArrowRight,
	ArrowUp,
	Check,
	ClipboardCopy,
	FlipHorizontal,
	FlipVertical,
	ClipboardPasteIcon as Paste,
	Redo,
	RotateCcw,
	RotateCw,
	Trash,
	Undo,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
	canvasToGrid,
	clampBaseline,
	clampXHeight,
	interpolatePoints,
	isInsideGrid,
	rotateGridToDimensions,
	shiftGrid,
} from "./bitmap-font-editor-helpers";
import {
	cloneGrid,
	createEmptyGrid,
	createGridFromBinary,
	getGridDimensions,
	gridToBinary,
	parseGridSize,
} from "./bitmap-font-utils";

interface BitmapFontEditorProps {
	selectedGridSize: string;
	selectedCharCode: number;
	currentCharacterBitmap?: string;
	setCurrentCharacterBitmap?: (bitmap: string) => void;
	onDataChange?: (newData: string, charCode: number) => void;
}

export default function BitmapFontEditor({
	selectedGridSize,
	selectedCharCode,
	currentCharacterBitmap = "",
	setCurrentCharacterBitmap,
	onDataChange,
}: BitmapFontEditorProps) {
	const [width, height] = parseGridSize(selectedGridSize);
	const cellSize = 40; // Fixed cell size for better visibility
	const previewRef = useRef<HTMLCanvasElement>(null);

	// X-height and baseline position state
	const [xHeight, setXHeight] = useState<number>(Math.floor(height * 0.6));
	const [baseline, setBaseline] = useState<number>(Math.floor(height * 0.8));

	// Canvas and context refs
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const gridRef = useRef<number[][]>([]);

	// Interaction state refs (not React state to avoid re-renders)
	const isDraggingRef = useRef(false);
	const drawModeRef = useRef<number | null>(null);
	const prevPositionRef = useRef<[number, number] | null>(null);
	const lastInteractionTimeRef = useRef<number>(0);
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
	const gridChangedRef = useRef(false);
	const currentCharRef = useRef<number>(selectedCharCode);

	// Persistent history storage keyed by character code and grid size
	const historyMapRef = useRef<
		Map<string, { history: number[][][]; index: number }>
	>(new Map());

	// Current working history reference
	const historyRef = useRef<number[][][]>([]);
	const historyIndexRef = useRef<number>(-1);

	// Add states to track undo/redo availability
	const [canUndo, setCanUndo] = useState(false);
	const [canRedo, setCanRedo] = useState(false);

	// Clipboard
	const clipboardRef = useRef<number[][] | null>(null);

	// Add state for copy success indicator
	const [showCopySuccess, setShowCopySuccess] = useState(false);

	// History key
	const getHistoryKey = useCallback(() => {
		return `${selectedCharCode}-${selectedGridSize}`;
	}, [selectedCharCode, selectedGridSize]);

	// Load history for current character
	const loadHistoryForCurrentChar = useCallback(() => {
		const key = getHistoryKey();
		const savedHistory = historyMapRef.current.get(key);

		if (savedHistory) {
			historyRef.current = savedHistory.history;
			historyIndexRef.current = savedHistory.index;
		} else {
			// If no history exists for this character, create one with current state
			const initialGridCopy = JSON.parse(JSON.stringify(gridRef.current));
			historyRef.current = [initialGridCopy];
			historyIndexRef.current = 0;
		}

		// Update UI states based on loaded history
		setCanUndo(historyIndexRef.current > 0);
		setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
	}, [getHistoryKey]);

	// Save current history to the map
	const saveHistoryForCurrentChar = useCallback(() => {
		const key = getHistoryKey();
		historyMapRef.current.set(key, {
			history: [...historyRef.current], // Make a copy of the history array
			index: historyIndexRef.current,
		});
	}, [getHistoryKey]);

	const getCanvasDrawState = useCallback((canvas: HTMLCanvasElement | null) => {
		const ctx = canvas?.getContext("2d");
		if (!canvas || !ctx) return null;

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		const grid = gridRef.current;
		const { width: actualWidth, height: actualHeight } =
			getGridDimensions(grid);

		if (actualHeight === 0 || actualWidth === 0) return null;

		return { canvas, ctx, actualWidth, actualHeight };
	}, []);

	// Update the preview canvas
	const updatePreview = useCallback(() => {
		const drawState = getCanvasDrawState(previewRef.current);
		if (!drawState) return;
		const { canvas, ctx, actualWidth, actualHeight } = drawState;

		// Set pixel size (1 pixel per grid cell)
		const pixelSize = 1;

		// Calculate dimensions
		const canvasWidth = actualWidth * pixelSize;
		const canvasHeight = actualHeight * pixelSize;

		// Resize canvas to match bitmap dimensions exactly
		canvas.width = canvasWidth;
		canvas.height = canvasHeight;

		// Draw cells - only filled cells (1s)
		ctx.fillStyle = "#000000";
		for (let y = 0; y < actualHeight; y++) {
			for (let x = 0; x < actualWidth; x++) {
				if (gridRef.current[y]?.[x]) {
					ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
				}
			}
		}
	}, [getCanvasDrawState]);

	// Draw the grid on the canvas
	const drawGrid = useCallback(() => {
		const drawState = getCanvasDrawState(canvasRef.current);
		if (!drawState) return;
		const { canvas, ctx, actualWidth, actualHeight } = drawState;

		const borderWidth = 1;
		const cellSizeWithBorder = cellSize + borderWidth;

		// Resize canvas to fit the actual grid size
		canvas.width = actualWidth * cellSizeWithBorder;
		canvas.height = actualHeight * cellSizeWithBorder;

		// Draw background
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Draw grid lines
		ctx.strokeStyle = "#e2e8f0"; // border color
		ctx.lineWidth = borderWidth;

		// Draw cells
		for (let y = 0; y < actualHeight; y++) {
			for (let x = 0; x < actualWidth; x++) {
				const cellX = x * cellSizeWithBorder;
				const cellY = y * cellSizeWithBorder;

				// Draw cell background with safe access to grid
				const cellValue = gridRef.current[y]?.[x] ?? 0;
				ctx.fillStyle = cellValue ? "#000000" : "#ffffff";
				ctx.fillRect(cellX, cellY, cellSize, cellSize);

				// Draw cell border
				ctx.strokeRect(cellX, cellY, cellSize, cellSize);
			}
		}

		// Draw x-height and baseline guides - adjust to actual dimensions
		const safeXHeight = Math.min(xHeight, actualHeight - 1);
		if (safeXHeight >= 0) {
			ctx.strokeStyle = "rgba(0, 128, 255, 0.8)";
			ctx.lineWidth = 2;
			const xHeightY = safeXHeight * cellSizeWithBorder;
			ctx.beginPath();
			ctx.moveTo(0, xHeightY);
			ctx.lineTo(canvas.width, xHeightY);
			ctx.stroke();
		}

		const safeBaseline = Math.min(baseline, actualHeight - 1);
		if (safeBaseline >= 0) {
			ctx.strokeStyle = "rgba(255, 128, 0, 0.8)";
			ctx.lineWidth = 2;
			const baselineY = safeBaseline * cellSizeWithBorder;
			ctx.beginPath();
			ctx.moveTo(0, baselineY);
			ctx.lineTo(canvas.width, baselineY);
			ctx.stroke();
		}

		// Update the preview
		updatePreview();
	}, [xHeight, baseline, updatePreview, getCanvasDrawState]);

	// Reset grid when selectedCharacter changes
	useEffect(() => {
		if (currentCharRef.current !== selectedCharCode) {
			// Save history for previous character
			saveHistoryForCurrentChar();

			gridRef.current = createGridFromBinary(
				currentCharacterBitmap,
				width,
				height,
			);

			// Update current character ref
			currentCharRef.current = selectedCharCode;

			// Load history for the new character
			loadHistoryForCurrentChar();

			// Redraw the grid
			drawGrid();
		}
	}, [
		selectedCharCode,
		currentCharacterBitmap,
		width,
		height,
		drawGrid,
		saveHistoryForCurrentChar,
		loadHistoryForCurrentChar,
	]);

	// Initialize grid when size changes or component mounts
	useEffect(() => {
		gridRef.current = createGridFromBinary(
			currentCharacterBitmap,
			width,
			height,
		);

		// Load or initialize history for current character
		loadHistoryForCurrentChar();

		// Redraw the grid
		drawGrid();
	}, [
		width,
		height,
		currentCharacterBitmap,
		drawGrid,
		loadHistoryForCurrentChar,
	]);

	// Initialize canvas
	useEffect(() => {
		const canvas = canvasRef.current;
		const previewCanvas = previewRef.current;
		if (!canvas || !previewCanvas) return;

		// Initial size will be set in drawGrid which handles actual dimensions
		previewCanvas.width = 100;
		previewCanvas.height = 100;

		// Initial draw (will set the correct canvas size based on actual grid)
		drawGrid();
	}, [drawGrid]);

	// Add to history
	const addToHistory = useCallback(() => {
		// Create a deep copy of the current grid
		const gridCopy = JSON.parse(JSON.stringify(gridRef.current));

		// Check if the current state is different from the last history entry
		const lastEntry = historyRef.current[historyIndexRef.current];
		if (lastEntry && JSON.stringify(lastEntry) === JSON.stringify(gridCopy)) {
			return; // Skip if no changes made
		}

		// Remove any future history if we're not at the end
		if (historyIndexRef.current < historyRef.current.length - 1) {
			historyRef.current = historyRef.current.slice(
				0,
				historyIndexRef.current + 1,
			);
		}

		// Add current state to history
		historyRef.current.push(gridCopy);
		historyIndexRef.current = historyRef.current.length - 1;

		// Limit history size to prevent memory issues
		if (historyRef.current.length > 50) {
			historyRef.current = historyRef.current.slice(
				historyRef.current.length - 50,
			);
			historyIndexRef.current = historyRef.current.length - 1;
		}

		// Update UI state
		setCanUndo(historyIndexRef.current > 0);
		setCanRedo(historyIndexRef.current < historyRef.current.length - 1);

		// Save updated history to the map
		saveHistoryForCurrentChar();
	}, [saveHistoryForCurrentChar]);

	// Update the character data in the parent component (debounced)
	const updateCharData = useCallback(() => {
		if (!gridChangedRef.current) return;

		// Clear any existing debounce timer
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}

		// Set a new debounce timer
		debounceTimerRef.current = setTimeout(() => {
			// Only update if the grid has changed
			if (gridChangedRef.current) {
				const binaryData = gridToBinary(gridRef.current);

				// Update local preview
				setCurrentCharacterBitmap?.(binaryData);

				// Notify parent component
				onDataChange?.(binaryData, selectedCharCode);
				gridChangedRef.current = false;

				// Make sure history is saved after parent updates
				saveHistoryForCurrentChar();
			}
		}, 300); // 300ms debounce
	}, [
		onDataChange,
		selectedCharCode,
		setCurrentCharacterBitmap,
		saveHistoryForCurrentChar,
	]);

	// Convert canvas coordinates to grid coordinates
	const getPointerGridPosition = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			const canvas = canvasRef.current;
			if (!canvas) return null;

			const rect = canvas.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			const [gridX, gridY] = canvasToGrid(x, y, cellSize);

			if (!isInsideGrid(gridX, gridY, width, height)) return null;

			return [gridX, gridY] as const;
		},
		[width, height],
	);

	// Handle mouse down
	const handleMouseDown = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			const gridPosition = getPointerGridPosition(e);
			if (!gridPosition) return;
			const [gridX, gridY] = gridPosition;

			// Set drawing state
			isDraggingRef.current = true;
			drawModeRef.current = gridRef.current[gridY][gridX] ? 0 : 1;
			prevPositionRef.current = [gridX, gridY];
			lastInteractionTimeRef.current = Date.now();

			// Update grid
			gridRef.current[gridY][gridX] = drawModeRef.current;
			gridChangedRef.current = true;

			// Redraw
			drawGrid();
		},
		[getPointerGridPosition, drawGrid],
	);

	// Handle mouse move
	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			if (!isDraggingRef.current || drawModeRef.current === null) return;

			const gridPosition = getPointerGridPosition(e);
			if (!gridPosition) return;
			const [gridX, gridY] = gridPosition;

			// Update last interaction time
			lastInteractionTimeRef.current = Date.now();

			// If we have a previous position, interpolate between them
			if (prevPositionRef.current) {
				const [prevX, prevY] = prevPositionRef.current;
				const points = interpolatePoints(prevX, prevY, gridX, gridY);

				// Fill all points along the line
				for (const [px, py] of points) {
					if (isInsideGrid(px, py, width, height)) {
						gridRef.current[py][px] = drawModeRef.current;
					}
				}
			} else {
				// Just fill the current point if no previous position
				gridRef.current[gridY][gridX] = drawModeRef.current;
			}

			// Update previous position
			prevPositionRef.current = [gridX, gridY];
			gridChangedRef.current = true;

			// Redraw
			drawGrid();
		},
		[width, height, getPointerGridPosition, drawGrid],
	);

	// Handle mouse up
	const handleMouseUp = useCallback(() => {
		if (!isDraggingRef.current) return;

		isDraggingRef.current = false;
		drawModeRef.current = null;
		prevPositionRef.current = null;

		// Add to history
		addToHistory();

		// Update character data (debounced)
		updateCharData();
	}, [addToHistory, updateCharData]);

	// Handle mouse leave
	const handleMouseLeave = useCallback(() => {
		handleMouseUp();
	}, [handleMouseUp]);

	// Tool operations
	const flipHorizontal = useCallback(() => {
		gridRef.current = gridRef.current.map((row) => [...row].reverse());
		gridChangedRef.current = true;
		drawGrid();
		addToHistory();
		updateCharData();
	}, [drawGrid, addToHistory, updateCharData]);

	const flipVertical = useCallback(() => {
		gridRef.current = [...gridRef.current].reverse().map((row) => [...row]);
		gridChangedRef.current = true;
		drawGrid();
		addToHistory();
		updateCharData();
	}, [drawGrid, addToHistory, updateCharData]);

	const rotate = useCallback(
		(direction: "clockwise" | "counter-clockwise") => {
			gridRef.current = rotateGridToDimensions(
				gridRef.current,
				direction,
				width,
				height,
			);

			gridChangedRef.current = true;
			drawGrid();
			addToHistory();
			updateCharData();
		},
		[drawGrid, addToHistory, updateCharData, width, height],
	);

	const rotateClockwise = useCallback(() => {
		rotate("clockwise");
	}, [rotate]);

	const rotateCounterClockwise = useCallback(() => {
		rotate("counter-clockwise");
	}, [rotate]);

	const shift = useCallback(
		(direction: "up" | "down" | "left" | "right") => {
			gridRef.current = shiftGrid(gridRef.current, width, height, direction);
			gridChangedRef.current = true;
			drawGrid();
			addToHistory();
			updateCharData();
		},
		[width, height, drawGrid, addToHistory, updateCharData],
	);

	const clear = useCallback(() => {
		gridRef.current = createEmptyGrid(width, height);

		gridChangedRef.current = true;
		drawGrid();
		addToHistory();
		updateCharData();
	}, [width, height, drawGrid, addToHistory, updateCharData]);

	const undo = useCallback(() => {
		if (historyIndexRef.current > 0) {
			historyIndexRef.current--;

			// Get grid state from history
			const prevState = historyRef.current[historyIndexRef.current];

			// Apply the state
			gridRef.current = cloneGrid(prevState);

			// Mark grid as changed
			gridChangedRef.current = true;

			// Redraw and update
			drawGrid();
			updateCharData();

			// Update undo/redo states
			setCanUndo(historyIndexRef.current > 0);
			setCanRedo(historyIndexRef.current < historyRef.current.length - 1);

			// Save updated history state
			saveHistoryForCurrentChar();
		}
	}, [drawGrid, updateCharData, saveHistoryForCurrentChar]);

	const redo = useCallback(() => {
		if (historyIndexRef.current < historyRef.current.length - 1) {
			historyIndexRef.current++;

			// Get grid state from history
			const nextState = historyRef.current[historyIndexRef.current];

			// Apply the state
			gridRef.current = cloneGrid(nextState);

			// Mark grid as changed
			gridChangedRef.current = true;

			// Redraw and update
			drawGrid();
			updateCharData();

			// Update undo/redo states
			setCanUndo(historyIndexRef.current > 0);
			setCanRedo(historyIndexRef.current < historyRef.current.length - 1);

			// Save updated history state
			saveHistoryForCurrentChar();
		}
	}, [drawGrid, updateCharData, saveHistoryForCurrentChar]);

	const copy = useCallback(() => {
		// Simply copy the current grid to clipboard
		clipboardRef.current = gridRef.current.map((row) => [...row]);
		// Show success indicator
		setShowCopySuccess(true);
		// Hide after 1.5 seconds
		setTimeout(() => setShowCopySuccess(false), 1500);
		// No need to update history or undo/redo state for copy
	}, []);

	const paste = useCallback(() => {
		if (clipboardRef.current) {
			// Directly apply the copied grid
			gridRef.current = clipboardRef.current.map((row) => [...row]);
			gridChangedRef.current = true;
			drawGrid();
			addToHistory();
			updateCharData();
		}
	}, [drawGrid, addToHistory, updateCharData]);

	// Ensure final state is saved when component unmounts
	useEffect(() => {
		const cleanup = () => {
			// Save the history for current character
			saveHistoryForCurrentChar();

			if (gridChangedRef.current) {
				const binaryData = gridToBinary(gridRef.current);

				// Only notify parent component of the change, don't update local state
				onDataChange?.(binaryData, selectedCharCode);
			}

			// Clear any debounce timer
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};

		return cleanup;
	}, [onDataChange, selectedCharCode, saveHistoryForCurrentChar]);

	// Add an effect to initialize history on component mount
	useEffect(() => {
		// Load history for current character on component mount
		loadHistoryForCurrentChar();
	}, [loadHistoryForCurrentChar]);

	// Global mouse up handler
	useEffect(() => {
		const handleGlobalMouseUp = () => {
			if (isDraggingRef.current) {
				handleMouseUp();
			}
		};

		window.addEventListener("mouseup", handleGlobalMouseUp);
		return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
	}, [handleMouseUp]);

	// Handle x-height change
	const handleXHeightChange = useCallback(
		(value: number[]) => {
			setXHeight(clampXHeight(value[0], height, baseline));
			drawGrid();
		},
		[height, baseline, drawGrid],
	);

	// Handle baseline change
	const handleBaselineChange = useCallback(
		(value: number[]) => {
			setBaseline(clampBaseline(value[0], height, xHeight));
			drawGrid();
		},
		[height, xHeight, drawGrid],
	);

	// Initialize x-height and baseline when size changes
	useEffect(() => {
		setXHeight(Math.floor(height * 0.6));
		setBaseline(Math.floor(height * 0.8));
	}, [height]);

	// After component mounts, capture initial state
	useEffect(() => {
		// Make sure we have an initial state in history
		if (historyRef.current.length === 0) {
			const initialGridCopy = JSON.parse(JSON.stringify(gridRef.current));
			historyRef.current = [initialGridCopy];
			historyIndexRef.current = 0;
			setCanUndo(false);
			setCanRedo(false);
		}
	}, []);

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap gap-2">
				<Button
					onClick={undo}
					disabled={!canUndo}
					variant="outline"
					size="icon"
					title="Undo"
					aria-label="Undo"
					className="active:bg-accent active:scale-95"
				>
					<Undo className="w-4 h-4" />
				</Button>
				<Button
					onClick={redo}
					disabled={!canRedo}
					variant="outline"
					size="icon"
					title="Redo"
					aria-label="Redo"
					className="active:bg-accent active:scale-95"
				>
					<Redo className="w-4 h-4" />
				</Button>
				<Button
					onClick={clear}
					variant="outline"
					size="icon"
					title="Clear"
					aria-label="Clear"
					className="active:bg-accent active:scale-95"
				>
					<Trash className="w-4 h-4" />
				</Button>
				<Button
					onClick={flipHorizontal}
					variant="outline"
					size="icon"
					title="Flip Horizontal"
					aria-label="Flip Horizontal"
					className="active:bg-accent active:scale-95"
				>
					<FlipHorizontal className="w-4 h-4" />
				</Button>
				<Button
					onClick={flipVertical}
					variant="outline"
					size="icon"
					title="Flip Vertical"
					aria-label="Flip Vertical"
					className="active:bg-accent active:scale-95"
				>
					<FlipVertical className="w-4 h-4" />
				</Button>
				<Button
					onClick={rotateClockwise}
					variant="outline"
					size="icon"
					title="Rotate Clockwise"
					aria-label="Rotate Clockwise"
					className="active:bg-accent active:scale-95"
				>
					<RotateCw className="w-4 h-4" />
				</Button>
				<Button
					onClick={rotateCounterClockwise}
					variant="outline"
					size="icon"
					title="Rotate Counter-clockwise"
					aria-label="Rotate Counter-clockwise"
					className="active:bg-accent active:scale-95"
				>
					<RotateCcw className="w-4 h-4" />
				</Button>

				{/* Group the shifting buttons together with no gap */}
				<div className="flex">
					<Button
						onClick={() => shift("up")}
						variant="outline"
						size="icon"
						title="Shift Up"
						aria-label="Shift Up"
						className="active:bg-accent active:scale-95 rounded-r-none border-r-0"
					>
						<ArrowUp className="w-4 h-4" />
					</Button>
					<Button
						onClick={() => shift("down")}
						variant="outline"
						size="icon"
						title="Shift Down"
						aria-label="Shift Down"
						className="active:bg-accent active:scale-95 rounded-none border-r-0"
					>
						<ArrowDown className="w-4 h-4" />
					</Button>
					<Button
						onClick={() => shift("left")}
						variant="outline"
						size="icon"
						title="Shift Left"
						aria-label="Shift Left"
						className="active:bg-accent active:scale-95 rounded-none border-r-0"
					>
						<ArrowLeft className="w-4 h-4" />
					</Button>
					<Button
						onClick={() => shift("right")}
						variant="outline"
						size="icon"
						title="Shift Right"
						aria-label="Shift Right"
						className="active:bg-accent active:scale-95 rounded-l-none"
					>
						<ArrowRight className="w-4 h-4" />
					</Button>
				</div>

				<Button
					onClick={copy}
					variant="outline"
					size="icon"
					title="Copy"
					aria-label="Copy"
					className="active:bg-accent active:scale-95 relative"
				>
					{showCopySuccess ? (
						<Check className="w-4 h-4 text-primary" />
					) : (
						<ClipboardCopy className="w-4 h-4" />
					)}
				</Button>
				<Button
					onClick={paste}
					disabled={!clipboardRef.current}
					variant="outline"
					size="icon"
					title="Paste"
					aria-label="Paste"
					className="active:bg-accent active:scale-95"
				>
					<Paste className="w-4 h-4" />
				</Button>
			</div>

			<div className="flex flex-row gap-4 items-start">
				<div className="relative">
					<canvas
						ref={canvasRef}
						className="cursor-crosshair dark:invert border-[0.5px] border-neutral-300"
						onMouseDown={handleMouseDown}
						onMouseMove={handleMouseMove}
						onMouseUp={handleMouseUp}
						onMouseLeave={handleMouseLeave}
					/>
				</div>
				<div className="flex flex-col items-center w-[100px]">
					<div className="flex items-center justify-center p-2 bg-card border mb-2 size-[100px]">
						<canvas
							ref={previewRef}
							className="dark:invert border-[0.25px] border-neutral-300"
							style={{
								imageRendering: "pixelated",
								transform: "scale(4)",
								transformOrigin: "center",
							}}
						/>
					</div>
					<div className="text-lg font-mono p-2 rounded-md bg-card border w-full">
						{String.fromCharCode(selectedCharCode)} {selectedCharCode}
					</div>

					<div className="flex flex-col gap-2 w-full">
						<Label
							htmlFor="x-height"
							className="flex items-center justify-between"
						>
							<span>X-Height</span>
							<span className="text-xs text-muted-foreground">{xHeight}</span>
						</Label>
						<Slider
							id="x-height"
							min={0}
							max={height - 1}
							step={1}
							value={[xHeight]}
							onValueChange={handleXHeightChange}
							className="mb-3"
						/>
					</div>

					<div className="flex flex-col gap-2 w-full">
						<Label
							htmlFor="baseline"
							className="flex items-center justify-between"
						>
							<span>Baseline</span>
							<span className="text-xs text-muted-foreground">{baseline}</span>
						</Label>
						<Slider
							id="baseline"
							min={0}
							max={height - 1}
							step={1}
							value={[baseline]}
							onValueChange={handleBaselineChange}
							className="mb-3"
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
