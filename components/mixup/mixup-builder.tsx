"use client";

import {
	ArrowLeft,
	Check,
	ChevronsUpDown,
	LayoutGrid,
	Save,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DeviceFrame } from "@/components/common/device-frame";
import {
	createScreenIdFromRecipe,
	promptScreenName,
} from "@/components/common/screen-from-recipe";
import {
	ScreenPreviewControls,
	screenPreviewSummary,
	useScreenPreviewControls,
} from "@/components/preview/screen-preview-controls";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	buildAssignments,
	LAYOUT_OPTIONS,
	type LayoutOption,
	type LayoutSlot,
	type MixupLayoutId,
} from "@/lib/mixup/constants";
import { cn } from "@/lib/utils";

type MixupRecipe = {
	id: string;
	slug: string;
	title: string;
	description?: string;
};

type MixupScreen = {
	id: string;
	title: string;
	description?: string;
};

type ContentOption = MixupRecipe | MixupScreen;
type SelectedContentOption = {
	title: string;
	description?: string;
	previewUrl: string;
};

export type MixupBuilderData = {
	id?: string;
	name: string;
	layout_id: MixupLayoutId | string;
	assignments: Record<string, string>;
};

interface MixupBuilderProps {
	recipes: MixupRecipe[];
	screens: MixupScreen[];
	initialData?: MixupBuilderData;
	onSave?: (data: MixupBuilderData) => void;
	onCancel?: () => void;
	isSaving?: boolean;
}

export function removeSlotAssignment(
	assignments: Record<string, string>,
	slotId: string,
) {
	const next = { ...assignments };
	delete next[slotId];
	return next;
}

export function recipeTitleById(recipes: MixupRecipe[], recipeId: string) {
	return (
		recipes.find((recipe) => recipe.id === recipeId)?.title ?? "New screen"
	);
}

export function normalizeContentRef(ref: string) {
	if (ref.startsWith("screen:") || ref.startsWith("recipe:")) return ref;
	return `recipe:${ref}`;
}

function ContentCommandGroup({
	heading,
	kind,
	options,
	selectedId,
	onSelect,
}: {
	heading: string;
	kind: "recipe" | "screen";
	options: ContentOption[];
	selectedId?: string;
	onSelect: (value: string) => void;
}) {
	return (
		<CommandGroup heading={heading}>
			{options.map((option) => {
				const value = `${kind}:${option.id}`;
				return (
					<CommandItem
						key={value}
						value={`${kind} ${option.title}`}
						onSelect={() => onSelect(value)}
					>
						<Check
							className={cn(
								"mr-2 h-4 w-4",
								selectedId === value ? "opacity-100" : "opacity-0",
							)}
						/>
						{option.title}
					</CommandItem>
				);
			})}
		</CommandGroup>
	);
}

export async function createScreenValueFromRecipe(
	recipeId: string,
	name: string,
) {
	const screenId = await createScreenIdFromRecipe(recipeId, name);
	return screenId ? `screen:${screenId}` : null;
}

export async function promoteRecipeValueToScreen(
	value: string,
	recipes: MixupRecipe[],
) {
	if (!value.startsWith("recipe:")) return value;

	const recipeId = value.slice("recipe:".length);
	const name = promptScreenName(recipeTitleById(recipes, recipeId));
	if (name === null) return null;

	return createScreenValueFromRecipe(recipeId, name);
}

export const spanLabel = (slot: LayoutSlot) => {
	const spanSize = (slot.colSpan ?? 1) * (slot.rowSpan ?? 1);
	return spanSize > 1 ? `${spanSize} quarters` : "1 quarter";
};

const LayoutTile = ({
	layout,
	active,
	onClick,
}: {
	layout: LayoutOption;
	active: boolean;
	onClick: () => void;
}) => {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-all",
				active
					? "border-primary bg-primary/5"
					: "border-transparent hover:border-border bg-card",
			)}
			aria-pressed={active}
		>
			<div className="aspect-[5/3] w-full overflow-hidden rounded-md border bg-muted/40 p-1">
				<div
					className="grid h-full w-full gap-0.5"
					style={{
						gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
						gridTemplateRows: "repeat(2, minmax(0, 1fr))",
					}}
				>
					{layout.slots.map((slot, i) => (
						<div
							key={slot.id}
							style={{
								gridColumn: `span ${slot.colSpan ?? 1}`,
								gridRow: `span ${slot.rowSpan ?? 1}`,
							}}
							className={cn(
								"rounded-[2px] bg-foreground/15",
								i === 0 && active && "bg-primary/60",
							)}
						/>
					))}
				</div>
			</div>
			<span className="text-[10px] font-medium capitalize text-muted-foreground">
				{layout.id.replace(/-/g, " ")}
			</span>
		</button>
	);
};

export function MixupBuilder({
	recipes,
	screens,
	initialData,
	onSave,
	onCancel,
	isSaving = false,
}: MixupBuilderProps) {
	const optionMap = useMemo(() => {
		const map = new Map<string, SelectedContentOption>();
		for (const recipe of recipes)
			map.set(`recipe:${recipe.id}`, {
				...recipe,
				previewUrl: `/api/bitmap/${recipe.id}.bmp`,
			});
		for (const screen of screens)
			map.set(`screen:${screen.id}`, {
				...screen,
				previewUrl: `/api/bitmap/screen/${screen.id}.bmp`,
			});
		return map;
	}, [recipes, screens]);

	const [name, setName] = useState(initialData?.name ?? "");
	const [layoutId, setLayoutId] = useState<MixupLayoutId | string>(
		initialData?.layout_id ?? LAYOUT_OPTIONS[0].id,
	);
	const [assignments, setAssignments] = useState<Record<string, string>>(() => {
		if (initialData?.assignments) return initialData.assignments;
		return buildAssignments(LAYOUT_OPTIONS[0], recipes);
	});
	const [activeSlot, setActiveSlot] = useState<string | null>(null);
	const preview = useScreenPreviewControls();

	useEffect(() => {
		if (initialData) {
			setName(initialData.name);
			setLayoutId(initialData.layout_id);
			setAssignments(initialData.assignments);
		}
	}, [initialData]);

	const currentLayout =
		LAYOUT_OPTIONS.find((option) => option.id === layoutId) ??
		LAYOUT_OPTIONS[0];

	useEffect(() => {
		// Reset / clamp active slot when layout changes
		if (activeSlot && !currentLayout.slots.some((s) => s.id === activeSlot)) {
			setActiveSlot(null);
		}
	}, [currentLayout, activeSlot]);

	const handleLayoutChange = (id: string) => {
		const nextLayout =
			LAYOUT_OPTIONS.find((option) => option.id === id) ?? currentLayout;
		setLayoutId(nextLayout.id);
		setAssignments((prev) => buildAssignments(nextLayout, recipes, prev));
	};

	const handleContentChange = async (slotId: string, value: string | null) => {
		if (!value) {
			setAssignments((prev) => removeSlotAssignment(prev, slotId));
			return;
		}

		const resolvedValue = await promoteRecipeValueToScreen(value, recipes);
		if (!resolvedValue) return;

		setAssignments((prev) => ({ ...prev, [slotId]: resolvedValue }));
	};

	const handleSave = () => {
		if (!name.trim()) return;
		onSave?.({
			id: initialData?.id,
			name: name.trim(),
			layout_id: layoutId,
			assignments,
		});
	};

	const filledSlots = currentLayout.slots.filter(
		(s) => assignments[s.id],
	).length;
	const isValid = name.trim().length > 0;

	return (
		<div className="flex flex-col gap-4">
			{/* Top bar */}
			<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					{onCancel && (
						<Button
							variant="ghost"
							size="icon"
							onClick={onCancel}
							aria-label="Back to mixups"
						>
							<ArrowLeft className="h-4 w-4" />
						</Button>
					)}
					<div className="flex min-w-0 flex-1 flex-col">
						<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
							{initialData?.id ? "Editing mixup" : "New mixup"}
						</span>
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Untitled mixup"
							className={cn(
								"h-auto border-0 bg-transparent p-0 text-lg font-semibold shadow-none",
								"focus-visible:ring-0 focus-visible:ring-offset-0",
							)}
						/>
					</div>
				</div>
				<div className="flex items-center gap-4">
					<div className="hidden text-right text-xs text-muted-foreground sm:block">
						<div className="font-semibold tabular-nums text-foreground">
							{filledSlots}/{currentLayout.slots.length}
						</div>
						<div>slots filled</div>
					</div>
					{onCancel && (
						<Button variant="outline" onClick={onCancel} disabled={isSaving}>
							Cancel
						</Button>
					)}
					<Button onClick={handleSave} disabled={!isValid || isSaving}>
						<Save className="mr-2 h-4 w-4" />
						{isSaving ? "Saving…" : initialData?.id ? "Update" : "Create"}
					</Button>
				</div>
			</div>

			{/* Split: preview left, configuration right */}
			<div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
				{/* Live preview */}
				<section className="flex flex-col overflow-hidden rounded-2xl border bg-card">
					<div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
						<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							Live preview
						</h3>
						<span className="text-[11px] tabular-nums text-muted-foreground">
							{currentLayout.slots.length} slots ·{" "}
							<span className="capitalize">{layoutId.replace(/-/g, " ")}</span>
						</span>
					</div>
					<ScreenPreviewControls
						format={preview.format}
						onFormatChange={preview.setFormat}
						sizeIndex={preview.sizeIndex}
						onSizeIndexChange={preview.setSizeIndex}
						paletteIndex={preview.paletteIndex}
						onPaletteIndexChange={preview.setPaletteIndex}
						isPortrait={preview.isPortrait}
						onPortraitChange={preview.setIsPortrait}
						formats={["bmp"]}
						className="border-b bg-muted/20"
					/>
					<div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_50%_0%,theme(colors.muted/40),transparent_70%)] p-6">
						<div className="w-full max-w-[640px]">
							<DeviceFrame
								size="lg"
								portrait={preview.isPortrait}
								screenWidth={preview.width}
								screenHeight={preview.height}
							>
								<div
									className="grid h-full w-full"
									style={{
										gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
										gridTemplateRows: "repeat(2, minmax(0, 1fr))",
									}}
								>
									{currentLayout.slots.map((slot) => {
										const selectedId = assignments[slot.id];
										const recipe = selectedId
											? optionMap.get(normalizeContentRef(selectedId))
											: null;
										const isActive = activeSlot === slot.id;
										const previewParams = new URLSearchParams({
											width: String(slot.width),
											height: String(slot.height),
											grayscale: String(preview.grayscale),
										});
										if (preview.paletteId) {
											previewParams.set("palette", preview.paletteId);
											previewParams.set("palette_preview", "observed");
										}
										const previewUrl = `${recipe?.previewUrl}?${previewParams}`;

										return (
											<button
												key={slot.id}
												type="button"
												onClick={() => setActiveSlot(slot.id)}
												style={{
													gridColumn: `span ${slot.colSpan ?? 1}`,
													gridRow: `span ${slot.rowSpan ?? 1}`,
												}}
												className={cn(
													"group relative overflow-hidden border border-black/40",
													isActive && "ring-2 ring-primary ring-offset-1",
												)}
												aria-label={`Edit ${slot.label}`}
												aria-pressed={isActive}
											>
												{recipe ? (
													<picture>
														<source srcSet={previewUrl} type="image/bmp" />
														<img
															src={previewUrl}
															alt={`${recipe.title} preview`}
															className="absolute inset-0 h-full w-full object-cover"
															style={{ imageRendering: "pixelated" }}
														/>
													</picture>
												) : (
													<div className="absolute inset-0 flex items-center justify-center bg-muted/40 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
														Empty
													</div>
												)}
												<div className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white opacity-0 transition-opacity group-hover:opacity-100">
													{slot.label}
												</div>
											</button>
										);
									})}
								</div>
							</DeviceFrame>
						</div>
					</div>
					<div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
						<span>Mixup BMP pipeline</span>
						<span className="tabular-nums">
							{screenPreviewSummary({
								format: "bmp",
								width: preview.width,
								height: preview.height,
								grayscale: preview.grayscale,
								paletteLabel: preview.paletteLabel,
							})}
						</span>
					</div>
				</section>

				{/* Configuration */}
				<section className="flex flex-col gap-4">
					{/* Layout picker */}
					<div className="overflow-hidden rounded-2xl border bg-card">
						<div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2">
							<LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
							<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Layout
							</h3>
						</div>
						<div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
							{LAYOUT_OPTIONS.map((option) => (
								<LayoutTile
									key={option.id}
									layout={option}
									active={option.id === currentLayout.id}
									onClick={() => handleLayoutChange(option.id)}
								/>
							))}
						</div>
					</div>

					{/* Slots */}
					<div className="overflow-hidden rounded-2xl border bg-card">
						<div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
							<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Slots
							</h3>
							<span className="rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
								{filledSlots}/{currentLayout.slots.length}
							</span>
						</div>
						<div className="divide-y">
							{currentLayout.slots.map((slot, index) => {
								const selectedId = assignments[slot.id];
								const recipe = selectedId
									? optionMap.get(normalizeContentRef(selectedId))
									: null;
								const isActive = activeSlot === slot.id;

								return (
									<div
										key={slot.id}
										className={cn(
											"flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
											isActive ? "bg-primary/5" : "bg-card",
										)}
									>
										<button
											type="button"
											onClick={() => setActiveSlot(slot.id)}
											className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-[11px] font-semibold tabular-nums text-muted-foreground transition-colors hover:bg-muted"
											aria-label={`Select ${slot.label}`}
											aria-pressed={isActive}
										>
											{index + 1}
										</button>
										<div className="min-w-0 flex-1">
											<div className="flex items-center justify-between gap-2 text-xs">
												<span className="font-semibold">{slot.label}</span>
												<span className="text-[10px] text-muted-foreground">
													{spanLabel(slot)}
												</span>
											</div>
											<div className="mt-1.5">
												<Popover>
													<PopoverTrigger asChild>
														<Button
															variant="outline"
															className="h-8 w-full justify-between text-xs"
															onClick={(e) => e.stopPropagation()}
														>
															<span className="truncate">
																{recipe?.title || "Choose content"}
															</span>
															<ChevronsUpDown className="ml-2 h-3.5 w-3.5 opacity-50" />
														</Button>
													</PopoverTrigger>
													<PopoverContent
														className="w-[--radix-popover-trigger-width] p-0"
														align="start"
														onClick={(e) => e.stopPropagation()}
													>
														<Command>
															<CommandInput placeholder="Search content…" />
															<CommandList>
																<CommandEmpty>No results found.</CommandEmpty>
																<ContentCommandGroup
																	heading="Recipes"
																	kind="recipe"
																	options={recipes}
																	selectedId={selectedId}
																	onSelect={(value) =>
																		handleContentChange(slot.id, value)
																	}
																/>
																<ContentCommandGroup
																	heading="Screens"
																	kind="screen"
																	options={screens}
																	selectedId={selectedId}
																	onSelect={(value) =>
																		handleContentChange(slot.id, value)
																	}
																/>
															</CommandList>
														</Command>
													</PopoverContent>
												</Popover>
												{recipe?.description && (
													<p className="mt-1 truncate text-[11px] text-muted-foreground">
														{recipe.description}
													</p>
												)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</section>
			</div>
		</div>
	);
}
