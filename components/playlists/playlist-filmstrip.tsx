"use client";

import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { DeviceFrame } from "@/components/common/device-frame";
import { PerforationMarks } from "@/components/playlists/perforation-marks";
import { playlistFrameBmpUrl } from "@/lib/playlist-url";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
} from "@/lib/recipes/constants";
import { cn } from "@/lib/utils";
import { formatPlaylistDuration } from "./duration-format";

export interface FilmstripFrame {
	id: string;
	screen_id: string;
	screen_type?: string;
	duration: number;
	label: string;
}

interface PlaylistFilmstripProps {
	frames: FilmstripFrame[];
	activeIndex: number;
	onSelect: (index: number) => void;
	onReorder: (from: number, to: number) => void;
	onAdd: () => void;
}

export function getPlaylistFilmstripSummary(frames: FilmstripFrame[]) {
	const totalSeconds = frames.reduce((sum, frame) => sum + frame.duration, 0);

	return {
		frameCountLabel: `${frames.length} ${frames.length === 1 ? "frame" : "frames"}`,
		totalLabel: formatPlaylistDuration(totalSeconds),
	};
}

export function getPlaylistFilmstripFrameClassName({
	isActive,
	isOver,
	isDragging,
}: {
	isActive: boolean;
	isOver: boolean;
	isDragging: boolean;
}) {
	return cn(
		"group relative shrink-0 cursor-grab active:cursor-grabbing",
		"w-[180px] overflow-hidden rounded-xl border-2 bg-neutral-900 transition-all",
		isActive
			? "border-primary shadow-[0_0_0_3px] shadow-primary/20"
			: "border-transparent hover:border-border",
		isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background",
		isDragging && "opacity-40",
	);
}

export function getPlaylistFilmstripFrameSrc(frame: FilmstripFrame) {
	return playlistFrameBmpUrl(
		frame.screen_id,
		frame.screen_type,
		DEFAULT_IMAGE_WIDTH,
		DEFAULT_IMAGE_HEIGHT,
	);
}

export function PlaylistFilmstrip({
	frames,
	activeIndex,
	onSelect,
	onReorder,
	onAdd,
}: PlaylistFilmstripProps) {
	const [dragIndex, setDragIndex] = useState<number | null>(null);
	const [overIndex, setOverIndex] = useState<number | null>(null);
	const scrollerRef = useRef<HTMLDivElement>(null);
	const summary = getPlaylistFilmstripSummary(frames);

	return (
		<div className="rounded-2xl border bg-card">
			<div className="flex items-center justify-between gap-4 border-b px-4 py-2.5">
				<div className="flex items-center gap-2 text-sm">
					<span className="font-medium">Timeline</span>
					<span className="text-muted-foreground">
						{summary.frameCountLabel} · {summary.totalLabel} loop
					</span>
				</div>
			</div>

			<div
				ref={scrollerRef}
				className="flex items-stretch gap-3 overflow-x-auto p-4 [scrollbar-width:thin]"
			>
				{/* Film perforations top + bottom, rendered per-frame below */}
				{frames.map((frame, index) => {
					const isActive = index === activeIndex;
					const isOver =
						overIndex === index && dragIndex !== null && dragIndex !== index;

					return (
						<button
							type="button"
							key={frame.id}
							draggable
							onClick={() => onSelect(index)}
							onDragStart={(e) => {
								setDragIndex(index);
								e.dataTransfer.effectAllowed = "move";
								e.dataTransfer.setData("text/plain", String(index));
							}}
							onDragOver={(e) => {
								e.preventDefault();
								e.dataTransfer.dropEffect = "move";
								if (overIndex !== index) setOverIndex(index);
							}}
							onDragLeave={() => {
								if (overIndex === index) setOverIndex(null);
							}}
							onDrop={(e) => {
								e.preventDefault();
								if (dragIndex !== null && dragIndex !== index) {
									onReorder(dragIndex, index);
								}
								setDragIndex(null);
								setOverIndex(null);
							}}
							onDragEnd={() => {
								setDragIndex(null);
								setOverIndex(null);
							}}
							className={getPlaylistFilmstripFrameClassName({
								isActive,
								isOver,
								isDragging: dragIndex === index,
							})}
							aria-label={`Frame ${index + 1}: ${frame.label}`}
							aria-pressed={isActive}
						>
							<PerforationMarks
								count={8}
								containerClassName="flex h-3 items-center justify-around bg-neutral-950 px-1"
								markClassName="h-1.5 w-2 rounded-[2px] bg-neutral-800"
							/>

							<div className="px-3 py-2">
								<div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-neutral-300">
									<span className="tabular-nums">#{index + 1}</span>
									<span className="tabular-nums">{frame.duration}s</span>
								</div>
							</div>

							<div className="mx-3">
								<DeviceFrame size="sm" flat>
									<picture>
										<source
											srcSet={getPlaylistFilmstripFrameSrc(frame)}
											type="image/bmp"
										/>
										<img
											src={getPlaylistFilmstripFrameSrc(frame)}
											alt={frame.label}
											width={DEFAULT_IMAGE_WIDTH}
											height={DEFAULT_IMAGE_HEIGHT}
											className="absolute inset-0 h-full w-full object-cover"
											style={{ imageRendering: "pixelated" }}
										/>
									</picture>
								</DeviceFrame>
							</div>

							<div className="px-3 py-2">
								<div className="truncate text-xs font-medium text-neutral-100">
									{frame.label}
								</div>
							</div>

							<PerforationMarks
								count={8}
								containerClassName="flex h-3 items-center justify-around bg-neutral-950 px-1"
								markClassName="h-1.5 w-2 rounded-[2px] bg-neutral-800"
							/>
						</button>
					);
				})}

				<button
					type="button"
					onClick={onAdd}
					className={cn(
						"flex w-[180px] shrink-0 flex-col items-center justify-center gap-2",
						"rounded-xl border-2 border-dashed border-border bg-muted/30",
						"text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary",
					)}
					aria-label="Add frame"
				>
					<Plus className="h-6 w-6" />
					<span className="text-sm font-medium">Add frame</span>
				</button>
			</div>
		</div>
	);
}
