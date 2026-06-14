"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	canAddGridSize,
	GRID_SELECTOR_CELL_SIZE,
	getGridCellFillStyle,
	getGridSizeFromPointer,
	MAX_GRID_SIZE,
} from "./add-grid-size-helpers";

// make google doc style boxes to add grid size, from 4x4 to 17x17, disable adding if the size is already in the list or too small

export default function AddGridSize({
	availableGridSizes,
	onAddSize,
}: {
	availableGridSizes: string[];
	onAddSize: (newSize: string) => void;
}) {
	const [hoveredSize, setHoveredSize] = useState<string | null>(null);
	const [open, setOpen] = useState(false);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const canvasSize = MAX_GRID_SIZE * GRID_SELECTOR_CELL_SIZE;
	const addHoveredSize = () => {
		if (!canAddGridSize(hoveredSize, availableGridSizes)) {
			return;
		}

		onAddSize(hoveredSize);
		toast.success(`Added grid size: ${hoveredSize}`);
		setOpen(false); // Close dropdown when size is selected
	};

	// Draw the grid on canvas
	const renderCanvas = useCallback(() => {
		if (!canvasRef.current) return;

		// Use requestAnimationFrame to ensure the browser is ready to render
		requestAnimationFrame(() => {
			const canvas = canvasRef.current;
			if (!canvas) return;

			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			// Clear canvas
			ctx.clearRect(0, 0, canvasSize, canvasSize);

			// Draw all cells
			for (let rowIdx = 1; rowIdx <= MAX_GRID_SIZE; rowIdx++) {
				for (let colIdx = 1; colIdx <= MAX_GRID_SIZE; colIdx++) {
					const size = `${colIdx}x${rowIdx}`;
					const x = (colIdx - 1) * GRID_SELECTOR_CELL_SIZE;
					const y = (rowIdx - 1) * GRID_SELECTOR_CELL_SIZE;

					ctx.fillStyle = getGridCellFillStyle(
						size,
						hoveredSize,
						availableGridSizes,
					);
					ctx.fillRect(
						x,
						y,
						GRID_SELECTOR_CELL_SIZE - 1,
						GRID_SELECTOR_CELL_SIZE - 1,
					);
				}
			}
		});
	}, [hoveredSize, availableGridSizes, canvasSize]);

	// Initial render when dropdown opens
	useEffect(() => {
		if (open) {
			// Add a small delay to ensure the canvas is in the DOM
			const timer = setTimeout(() => {
				renderCanvas();
			}, 50);

			return () => clearTimeout(timer);
		}
	}, [open, renderCanvas]);

	// Re-render on hover changes
	useEffect(() => {
		if (open) {
			renderCanvas();
		}
	}, [open, renderCanvas]);

	// Handle canvas interactions
	const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		setHoveredSize(getGridSizeFromPointer(e.clientX, e.clientY, rect));
	};

	const handleCanvasClick = () => {
		const canvas = canvasRef.current;
		if (!canvas || !hoveredSize) return;

		addHoveredSize();
	};

	const handleCanvasKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
		if ((e.key === "Enter" || e.key === " ") && hoveredSize) {
			addHoveredSize();
		}
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm">
					Add Grid Size
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="p-2"
				onCloseAutoFocus={(e) => e.preventDefault()}
			>
				<DropdownMenuLabel>
					{hoveredSize ? hoveredSize : "Select Grid Size"}
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<div className="relative">
					<canvas
						ref={canvasRef}
						width={canvasSize}
						height={canvasSize}
						onMouseMove={handleCanvasMouseMove}
						onClick={handleCanvasClick}
						onKeyDown={handleCanvasKeyDown}
						onMouseLeave={() => setHoveredSize(null)}
						tabIndex={0}
						aria-label="Grid size selector"
						className="focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
