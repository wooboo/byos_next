import {
	copyGridIntoDimensions,
	createEmptyGrid,
	getGridDimensions,
	rotateGrid,
} from "./bitmap-font-utils";

export const interpolatePoints = (
	x0: number,
	y0: number,
	x1: number,
	y1: number,
): [number, number][] => {
	const points: [number, number][] = [];
	const dx = Math.abs(x1 - x0);
	const dy = Math.abs(y1 - y0);
	const sx = x0 < x1 ? 1 : -1;
	const sy = y0 < y1 ? 1 : -1;
	let err = dx - dy;

	while (true) {
		points.push([x0, y0]);
		if (x0 === x1 && y0 === y1) break;
		const e2 = 2 * err;
		if (e2 > -dy) {
			err -= dy;
			x0 += sx;
		}
		if (e2 < dx) {
			err += dx;
			y0 += sy;
		}
	}

	return points;
};

export const isInsideGrid = (
	gridX: number,
	gridY: number,
	width: number,
	height: number,
) => gridX >= 0 && gridX < width && gridY >= 0 && gridY < height;

export const canvasToGrid = (
	x: number,
	y: number,
	cellSize: number,
	borderWidth = 1,
): [number, number] => {
	const cellSizeWithBorder = cellSize + borderWidth;
	return [
		Math.floor(x / cellSizeWithBorder),
		Math.floor(y / cellSizeWithBorder),
	];
};

export const rotateGridToDimensions = (
	grid: number[][],
	direction: "clockwise" | "counter-clockwise",
	width: number,
	height: number,
): number[][] => {
	const { width: currentWidth, height: currentHeight } =
		getGridDimensions(grid);
	const rotatedGrid = rotateGrid(grid, direction);

	if (currentWidth === height && currentHeight === width) {
		return rotatedGrid;
	}

	return copyGridIntoDimensions(
		rotatedGrid,
		width,
		height,
		copyGridIntoDimensions(grid, width, height),
	);
};

export const shiftGrid = (
	grid: number[][],
	width: number,
	height: number,
	direction: "up" | "down" | "left" | "right",
): number[][] => {
	const shiftedGrid = createEmptyGrid(width, height);

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			let newX = x;
			let newY = y;

			if (direction === "up") {
				newY = (y + height - 1) % height;
			} else if (direction === "down") {
				newY = (y + 1) % height;
			} else if (direction === "left") {
				newX = (x + width - 1) % width;
			} else if (direction === "right") {
				newX = (x + 1) % width;
			}

			shiftedGrid[newY][newX] = grid[y][x];
		}
	}

	return shiftedGrid;
};

export const clampXHeight = (
	value: number,
	height: number,
	baseline: number,
): number => {
	const nextValue = Math.min(Math.max(0, value), height - 1);
	return nextValue > baseline ? baseline - 1 : nextValue;
};

export const clampBaseline = (
	value: number,
	height: number,
	xHeight: number,
): number => {
	const nextValue = Math.min(Math.max(0, value), height - 1);
	return nextValue < xHeight ? xHeight + 1 : nextValue;
};
