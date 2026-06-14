import { isGridSizeUnavailable } from "./bitmap-font-utils";

export const MAX_GRID_SIZE = 17;
export const GRID_SELECTOR_CELL_SIZE = 8;

export const getGridSizeFromPointer = (
	clientX: number,
	clientY: number,
	rect: { left: number; top: number },
	cellSize = GRID_SELECTOR_CELL_SIZE,
	maxGridSize = MAX_GRID_SIZE,
): string | null => {
	const x = Math.floor((clientX - rect.left) / cellSize) + 1;
	const y = Math.floor((clientY - rect.top) / cellSize) + 1;

	if (x < 1 || x > maxGridSize || y < 1 || y > maxGridSize) {
		return null;
	}

	return `${x}x${y}`;
};

export const canAddGridSize = (
	gridSize: string | null,
	availableGridSizes: string[],
): gridSize is string => {
	return Boolean(
		gridSize && !isGridSizeUnavailable(gridSize, availableGridSizes),
	);
};

export const getGridCellFillStyle = (
	gridSize: string,
	hoveredSize: string | null,
	availableGridSizes: string[],
): string => {
	const isDisabled = isGridSizeUnavailable(gridSize, availableGridSizes);

	if (gridSize === hoveredSize && !isDisabled) {
		return "#3b82f6";
	}

	return isDisabled ? "rgba(229, 231, 235, 0.5)" : "#e5e7eb";
};
