// Convert base64 to binary string (for JSON storage)
export const base64ToBinary = (base64: string): string => {
	// Decode base64 to binary
	const binary = atob(base64);
	// Convert each byte to its binary representation
	return Array.from(binary)
		.map((char) => char.charCodeAt(0).toString(2).padStart(8, "0"))
		.join("");
};

// Convert binary string to base64 (for JSON storage)
export const binaryToBase64 = (binary: string): string => {
	// Group binary string into 8-bit chunks
	const bytes = [];
	for (let i = 0; i < binary.length; i += 8) {
		const chunk = binary.slice(i, Math.min(i + 8, binary.length));
		// Only process complete or padded chunks
		if (chunk.length > 0) {
			const paddedChunk = chunk.padEnd(8, "0");
			bytes.push(parseInt(paddedChunk, 2));
		}
	}

	// Convert bytes to base64
	return btoa(String.fromCharCode(...bytes));
};

export const parseGridSize = (gridSize: string): [number, number] => {
	const [width, height] = gridSize.split("x").map(Number);
	return [width, height];
};

export const isGridSizeUnavailable = (
	gridSize: string,
	availableGridSizes: string[],
): boolean => {
	const [width, height] = parseGridSize(gridSize);
	return availableGridSizes.includes(gridSize) || (width <= 4 && height <= 4);
};

export const binaryToSvgPath = (
	binary: string,
	width: number,
	height: number,
): string => {
	const cellCount = width * height;
	const binaryArray = binary.padEnd(cellCount, "0").slice(0, cellCount);

	return Array.from({ length: cellCount })
		.map((_, i) => {
			if (i >= binaryArray.length) return "";
			const isBlack = binaryArray[i] === "1";
			if (!isBlack) return "";
			const x = i % width;
			const y = Math.floor(i / width);
			return `M ${x} ${y} h 1 v 1 h -1 z`;
		})
		.join(" ");
};

export const createEmptyGrid = (width: number, height: number): number[][] =>
	Array(height)
		.fill(0)
		.map(() => Array(width).fill(0));

export const getGridDimensions = (
	grid: number[][],
): { width: number; height: number } => {
	const height = grid.length;
	const width = height > 0 ? grid[0].length : 0;
	return { width, height };
};

export const cloneGrid = (grid: number[][]): number[][] =>
	grid.map((row) => [...row]);

// Convert binary string to 2D grid
export const binaryToGrid = (
	binary: string,
	width: number,
	height: number,
): number[][] => {
	const grid: number[][] = [];

	// Ensure binary string is the correct length
	const paddedBinary = binary.padEnd(width * height, "0");

	for (let y = 0; y < height; y++) {
		const row: number[] = [];
		for (let x = 0; x < width; x++) {
			const index = y * width + x;
			row.push(Number(paddedBinary[index]));
		}
		grid.push(row);
	}
	return grid;
};

// Convert 2D grid to binary string
export const gridToBinary = (grid: number[][]): string => {
	return grid.flat().join("");
};

export const createGridFromBinary = (
	binary: string | undefined,
	width: number,
	height: number,
): number[][] => {
	if (binary) {
		return binaryToGrid(binary, width, height);
	}
	return createEmptyGrid(width, height);
};

export const copyGridIntoDimensions = (
	sourceGrid: number[][],
	width: number,
	height: number,
	baseGrid = createEmptyGrid(width, height),
): number[][] => {
	const { width: sourceWidth, height: sourceHeight } =
		getGridDimensions(sourceGrid);

	for (let y = 0; y < Math.min(height, sourceHeight); y++) {
		for (let x = 0; x < Math.min(width, sourceWidth); x++) {
			baseGrid[y][x] = sourceGrid[y][x];
		}
	}

	return baseGrid;
};

export const rotateGrid = (
	grid: number[][],
	direction: "clockwise" | "counter-clockwise",
): number[][] => {
	const { width, height } = getGridDimensions(grid);
	const rotated = createEmptyGrid(height, width);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (direction === "clockwise") {
				rotated[x][height - 1 - y] = grid[y][x];
			} else {
				rotated[width - 1 - x][y] = grid[y][x];
			}
		}
	}

	return rotated;
};
