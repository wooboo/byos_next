"use client";

import { Check, ChevronsUpDown, RefreshCw, Search } from "lucide-react";
import Image from "next/image";
import type React from "react";
import { DeviceFrame } from "@/components/common/device-frame";
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
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { resolveRenderableContentType } from "@/lib/content-ref";
import { DeviceDisplayMode } from "@/lib/mixup/constants";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
} from "@/lib/recipes/constants";
import type { Device, Mixup, Playlist } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatTimezone, timezones } from "@/utils/helpers";

const DEVICE_SIZE_PRESETS = {
	"800x480": { width: 800, height: 480 },
	"1872x1404": { width: 1872, height: 1404 },
	"2048x1536": { width: 2048, height: 1536 },
	custom: null,
} as const;

type DeviceSizePreset = keyof typeof DEVICE_SIZE_PRESETS;

interface DeviceEditFormProps {
	editedDevice: Device & { status?: string; type?: string };
	availableScreens: { id: string; title: string }[];
	availableRecipes: { id: string; title: string }[];
	availablePlaylists: Playlist[];
	availableMixups: Mixup[];
	deviceSizePreset: DeviceSizePreset;
	apiKeyError: string | null;
	friendlyIdError: string | null;
	isSaving: boolean;
	onInputChange: (
		e: React.ChangeEvent<
			HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
		>,
	) => void;
	onNestedInputChange: (path: string, value: string) => void;
	onSelectChange: (name: string, value: string) => void;
	onContentRefChange: (
		kind: "recipe" | "screen" | "playlist" | "mixup" | "none",
		id: string | null,
	) => void;
	onDeviceSizePresetChange: (preset: DeviceSizePreset) => void;
	onCustomSizeChange: (field: "width" | "height", value: number) => void;
	onRegenerateApiKey: () => void;
	onRegenerateFriendlyId: () => void;
	onAddTimeRange: () => void;
	onSubmit: (e?: React.FormEvent | React.MouseEvent) => void;
	onCancel: () => void;
}

export default function DeviceEditForm({
	editedDevice,
	availableScreens,
	availableRecipes,
	availablePlaylists,
	availableMixups,
	deviceSizePreset,
	apiKeyError,
	friendlyIdError,
	isSaving: _isSaving,
	onInputChange,
	onNestedInputChange,
	onSelectChange,
	onContentRefChange,
	onDeviceSizePresetChange,
	onCustomSizeChange,
	onRegenerateApiKey,
	onRegenerateFriendlyId,
	onAddTimeRange,
	onSubmit,
	onCancel: _onCancel,
}: DeviceEditFormProps) {
	const preview = useScreenPreviewControls({
		defaultPortrait: editedDevice.screen_orientation === "portrait",
	});
	const isPortrait = preview.isPortrait;
	const previewWidth = preview.width;
	const previewHeight = preview.height;
	const deviceGrayscale =
		editedDevice.grayscale === 2 ||
		editedDevice.grayscale === 4 ||
		editedDevice.grayscale === 16
			? editedDevice.grayscale
			: 16;

	const isPlaylist =
		editedDevice.display_mode === DeviceDisplayMode.PLAYLIST &&
		!!editedDevice.playlist_id;
	const isMixup =
		editedDevice.display_mode === DeviceDisplayMode.MIXUP &&
		!!editedDevice.mixup_id;
	const legacySingleScreenId = editedDevice.screen_id || editedDevice.screen;
	const legacySingleScreenType = resolveRenderableContentType(
		editedDevice.screen_type,
		legacySingleScreenId,
	);
	const selectedContentValue = isPlaylist
		? `playlist:${editedDevice.playlist_id}`
		: isMixup
			? `mixup:${editedDevice.mixup_id}`
			: legacySingleScreenId
				? `${legacySingleScreenType}:${legacySingleScreenId}`
				: "none";
	const selectedContentLabel =
		selectedContentValue === "none"
			? "None (use default)"
			: selectedContentValue.startsWith("recipe:")
				? availableRecipes.find(
						(recipe) => `recipe:${recipe.id}` === selectedContentValue,
					)?.title
				: selectedContentValue.startsWith("screen:")
					? availableScreens.find(
							(screen) => `screen:${screen.id}` === selectedContentValue,
						)?.title
					: selectedContentValue.startsWith("playlist:")
						? availablePlaylists.find(
								(playlist) =>
									`playlist:${playlist.id}` === selectedContentValue,
							)?.name
						: availableMixups.find(
								(mixup) => `mixup:${mixup.id}` === selectedContentValue,
							)?.name;
	const previewId = legacySingleScreenId || "simple-text";
	const previewType = resolveRenderableContentType(
		editedDevice.screen_type,
		previewId,
	);
	const bitmapBase = isMixup
		? `/api/bitmap/mixup/${editedDevice.mixup_id}.bmp`
		: previewType === "screen"
			? `/api/bitmap/screen/${previewId}.bmp`
			: `/api/bitmap/${previewId}.bmp`;
	const heroSrc = `${bitmapBase}?width=${previewWidth}&height=${previewHeight}&grayscale=${preview.grayscale}`;
	const pngSrc = `/api/png/${previewType}/${previewId}?width=${previewWidth}&height=${previewHeight}`;
	const reactSrc = `/preview/${previewType}/${previewId}?width=${previewWidth}&height=${previewHeight}`;

	return (
		<form onSubmit={onSubmit}>
			<div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
				{/* Hero preview — left column, sticky on lg */}
				<section className="flex flex-col overflow-hidden rounded-2xl border bg-card lg:sticky lg:top-4 lg:self-start">
					<div className="space-y-2 border-b bg-muted/30 px-3 py-2">
						<div className="flex items-center justify-between gap-2">
							<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
								Live preview
							</h3>
						</div>
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
						className="border-b bg-muted/20 px-3"
					/>
					<div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_50%_0%,theme(colors.muted/40),transparent_70%)] p-6">
						{isPlaylist ? (
							<div className="text-center text-sm text-muted-foreground">
								Playlist mode — preview shows on the device when saved.
							</div>
						) : isMixup && preview.format !== "bmp" ? (
							<div className="text-center text-sm text-muted-foreground">
								{preview.format.toUpperCase()} preview is not available for
								mixups yet.
							</div>
						) : (
							<div
								className={cn(
									"w-full",
									isPortrait ? "max-w-[260px]" : "max-w-[520px]",
								)}
							>
								<DeviceFrame size="lg" portrait={isPortrait}>
									{preview.format === "react" ? (
										<iframe
											title="Device React preview"
											src={reactSrc}
											className="absolute inset-0 h-full w-full border-0 bg-white"
										/>
									) : (
										<Image
											src={preview.format === "png" ? pngSrc : heroSrc}
											alt="Device screen preview"
											fill
											className="absolute inset-0 h-full w-full object-cover"
											style={{ imageRendering: "pixelated" }}
											unoptimized
										/>
									)}
								</DeviceFrame>
							</div>
						)}
					</div>
					<div className="border-t bg-muted/20 px-4 py-3 text-xs">
						<div className="grid gap-1.5 sm:grid-cols-4">
							<MetaRow label="Pipeline">
								{screenPreviewSummary({
									format: preview.format,
									width: previewWidth,
									height: previewHeight,
									grayscale: preview.grayscale,
								})}
							</MetaRow>
							<MetaRow label="Mode">
								<span className="capitalize">
									{editedDevice.display_mode.toLowerCase()}
								</span>
							</MetaRow>
							<MetaRow label="Timezone">
								{editedDevice?.timezone
									? formatTimezone(editedDevice.timezone)
									: "—"}
							</MetaRow>
							<MetaRow label="Refresh">
								{editedDevice?.refresh_schedule?.default_refresh_rate || 300}s
							</MetaRow>
						</div>
					</div>
				</section>

				{/* Form — right column with tabs */}
				<section className="overflow-hidden rounded-2xl border bg-card">
					<div className="border-b bg-muted/30 px-4 py-2">
						<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
							Configuration
						</h3>
					</div>
					<Tabs defaultValue="essentials" className="p-4">
						<TabsList className="grid w-full grid-cols-4">
							<TabsTrigger value="essentials">Essentials</TabsTrigger>
							<TabsTrigger value="content">Content</TabsTrigger>
							<TabsTrigger value="display">Display</TabsTrigger>
							<TabsTrigger value="refresh">Refresh</TabsTrigger>
						</TabsList>

						<TabsContent value="essentials" className="mt-4 space-y-4">
							<Field label="Device name" htmlFor="name">
								<Input
									id="name"
									name="name"
									value={editedDevice?.name || ""}
									onChange={onInputChange}
								/>
							</Field>
							<Field label="MAC address" htmlFor="mac_address">
								<Input
									id="mac_address"
									name="mac_address"
									value={editedDevice?.mac_address || ""}
									onChange={onInputChange}
									className="font-mono text-sm"
								/>
							</Field>
							<Field
								label="Friendly ID"
								htmlFor="friendly_id"
								error={friendlyIdError}
							>
								<div className="flex gap-2">
									<Input
										id="friendly_id"
										name="friendly_id"
										value={editedDevice?.friendly_id || ""}
										onChange={onInputChange}
										className="font-mono"
									/>
									<Button
										type="button"
										variant="outline"
										size="icon"
										onClick={onRegenerateFriendlyId}
										title="Generate new Friendly ID"
									>
										<RefreshCw className="h-4 w-4" />
									</Button>
								</div>
							</Field>
							<Field label="API key" htmlFor="api_key" error={apiKeyError}>
								<div className="flex gap-2">
									<Input
										id="api_key"
										name="api_key"
										value={editedDevice?.api_key || ""}
										onChange={onInputChange}
										className="font-mono"
									/>
									<Button
										type="button"
										variant="outline"
										size="icon"
										onClick={onRegenerateApiKey}
										title="Generate new API key"
									>
										<RefreshCw className="h-4 w-4" />
									</Button>
								</div>
							</Field>
							<Field label="Timezone" htmlFor="timezone">
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className="w-full justify-between font-normal"
										>
											{editedDevice?.timezone
												? formatTimezone(editedDevice.timezone)
												: "Select timezone…"}
											<Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-[300px] p-0">
										<Command>
											<CommandInput placeholder="Search timezone…" />
											<CommandEmpty>No timezone found.</CommandEmpty>
											<CommandList>
												<ScrollArea className="h-[300px]">
													{[
														"Europe",
														"North America",
														"Asia",
														"Australia & Pacific",
													].map((region) => (
														<CommandGroup key={region} heading={region}>
															{timezones
																.filter((tz) => tz.region === region)
																.map((tz) => (
																	<CommandItem
																		key={tz.value}
																		value={tz.value}
																		onSelect={() =>
																			onSelectChange("timezone", tz.value)
																		}
																		className="cursor-pointer"
																	>
																		<span
																			className={cn(
																				"mr-2",
																				editedDevice?.timezone === tz.value &&
																					"font-medium",
																			)}
																		>
																			{tz.label}
																		</span>
																	</CommandItem>
																))}
														</CommandGroup>
													))}
												</ScrollArea>
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>
							</Field>
						</TabsContent>

						<TabsContent value="content" className="mt-4 space-y-4">
							<Field
								label="Content"
								hint="Choose what this device should render."
							>
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											role="combobox"
											className="w-full justify-between"
										>
											<span className="truncate">
												{selectedContentLabel || "Search or select content…"}
											</span>
											<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
										</Button>
									</PopoverTrigger>
									<PopoverContent
										className="w-[--radix-popover-trigger-width] p-0"
										align="start"
									>
										<Command>
											<CommandInput placeholder="Search content…" />
											<CommandList>
												<CommandEmpty>No results found.</CommandEmpty>
												<CommandGroup heading="Recipes">
													{availableRecipes.map((recipe) => {
														const value = `recipe:${recipe.id}`;
														return (
															<CommandItem
																key={value}
																value={`recipe ${recipe.title}`}
																onSelect={() =>
																	onContentRefChange("recipe", recipe.id)
																}
															>
																<Check
																	className={cn(
																		"mr-2 h-4 w-4",
																		selectedContentValue === value
																			? "opacity-100"
																			: "opacity-0",
																	)}
																/>
																{recipe.title}
															</CommandItem>
														);
													})}
												</CommandGroup>
												<CommandGroup heading="Screens">
													{availableScreens.map((screen) => {
														const value = `screen:${screen.id}`;
														return (
															<CommandItem
																key={value}
																value={`screen ${screen.title}`}
																onSelect={() =>
																	onContentRefChange("screen", screen.id)
																}
															>
																<Check
																	className={cn(
																		"mr-2 h-4 w-4",
																		selectedContentValue === value
																			? "opacity-100"
																			: "opacity-0",
																	)}
																/>
																{screen.title}
															</CommandItem>
														);
													})}
												</CommandGroup>
												<CommandGroup heading="Playlists">
													{availablePlaylists.map((playlist) => (
														<CommandItem
															key={`playlist:${playlist.id}`}
															value={`playlist ${playlist.name}`}
															onSelect={() =>
																onContentRefChange("playlist", playlist.id)
															}
														>
															<Check
																className={cn(
																	"mr-2 h-4 w-4",
																	selectedContentValue ===
																		`playlist:${playlist.id}`
																		? "opacity-100"
																		: "opacity-0",
																)}
															/>
															{playlist.name}
														</CommandItem>
													))}
												</CommandGroup>
												<CommandGroup heading="Mixups">
													{availableMixups.map((mixup) => (
														<CommandItem
															key={`mixup:${mixup.id}`}
															value={`mixup ${mixup.name}`}
															onSelect={() =>
																onContentRefChange("mixup", mixup.id)
															}
														>
															<Check
																className={cn(
																	"mr-2 h-4 w-4",
																	selectedContentValue === `mixup:${mixup.id}`
																		? "opacity-100"
																		: "opacity-0",
																)}
															/>
															{mixup.name}
														</CommandItem>
													))}
												</CommandGroup>
											</CommandList>
										</Command>
									</PopoverContent>
								</Popover>
							</Field>
						</TabsContent>

						<TabsContent value="display" className="mt-4 space-y-4">
							<Field label="Device size" htmlFor="device_size_preset">
								<Select
									value={deviceSizePreset}
									onValueChange={(value) =>
										onDeviceSizePresetChange(value as DeviceSizePreset)
									}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select device size…" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="800x480">800 × 480</SelectItem>
										<SelectItem value="1872x1404">1872 × 1404</SelectItem>
										<SelectItem value="2048x1536">2048 × 1536</SelectItem>
										<SelectItem value="custom">Custom</SelectItem>
									</SelectContent>
								</Select>
							</Field>

							{deviceSizePreset === "custom" && (
								<div className="grid gap-3 sm:grid-cols-2">
									<Field label="Width (px)" htmlFor="screen_width">
										<Input
											id="screen_width"
											name="screen_width"
											type="number"
											min={1}
											value={editedDevice?.screen_width || DEFAULT_IMAGE_WIDTH}
											onChange={(e) =>
												onCustomSizeChange(
													"width",
													Number.parseInt(e.target.value, 10) ||
														DEFAULT_IMAGE_WIDTH,
												)
											}
										/>
									</Field>
									<Field label="Height (px)" htmlFor="screen_height">
										<Input
											id="screen_height"
											name="screen_height"
											type="number"
											min={1}
											value={
												editedDevice?.screen_height || DEFAULT_IMAGE_HEIGHT
											}
											onChange={(e) =>
												onCustomSizeChange(
													"height",
													Number.parseInt(e.target.value, 10) ||
														DEFAULT_IMAGE_HEIGHT,
												)
											}
										/>
									</Field>
								</div>
							)}

							<Field label="Orientation" htmlFor="screen_orientation">
								<Select
									value={editedDevice?.screen_orientation || "landscape"}
									onValueChange={(value) =>
										onSelectChange("screen_orientation", value)
									}
								>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select orientation…" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="landscape">Landscape</SelectItem>
										<SelectItem value="portrait">Portrait</SelectItem>
									</SelectContent>
								</Select>
							</Field>

							<Field
								label="Grayscale levels"
								hint="Number of gray levels for image rendering."
							>
								<ToggleGroup
									type="single"
									value={String(deviceGrayscale)}
									onValueChange={(value) => {
										if (value) onSelectChange("grayscale", value);
									}}
									variant="outline"
									className="grid w-fit grid-cols-3"
								>
									<ToggleGroupItem value="2">2</ToggleGroupItem>
									<ToggleGroupItem value="4">4</ToggleGroupItem>
									<ToggleGroupItem value="16">16</ToggleGroupItem>
								</ToggleGroup>
							</Field>
						</TabsContent>

						<TabsContent value="refresh" className="mt-4 space-y-4">
							<Field
								label="Default refresh rate"
								htmlFor="refresh_schedule.default_refresh_rate"
								hint="Seconds between refreshes when no time range applies."
							>
								<Input
									id="refresh_schedule.default_refresh_rate"
									name="refresh_schedule.default_refresh_rate"
									type="number"
									value={
										editedDevice?.refresh_schedule?.default_refresh_rate || 300
									}
									onChange={onInputChange}
								/>
							</Field>

							<div className="space-y-2">
								<div className="flex items-end justify-between gap-2">
									<div>
										<Label className="text-xs font-semibold">
											Time-range overrides
										</Label>
										<p className="text-[11px] text-muted-foreground">
											Use a different rate during specific windows.
										</p>
									</div>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={onAddTimeRange}
									>
										Add range
									</Button>
								</div>

								{editedDevice?.refresh_schedule?.time_ranges &&
								editedDevice.refresh_schedule.time_ranges.length > 0 ? (
									<div className="divide-y rounded-lg border">
										{editedDevice.refresh_schedule.time_ranges.map(
											(range, index) => (
												<div key={index} className="grid grid-cols-3 gap-2 p-3">
													<div className="space-y-1">
														<Label
															htmlFor={`start_time_${index}`}
															className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
														>
															Start
														</Label>
														<Input
															id={`start_time_${index}`}
															type="time"
															value={range.start_time}
															onChange={(e) =>
																onNestedInputChange(
																	`refresh_schedule.time_ranges.${index}.start_time`,
																	e.target.value,
																)
															}
														/>
													</div>
													<div className="space-y-1">
														<Label
															htmlFor={`end_time_${index}`}
															className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
														>
															End
														</Label>
														<Input
															id={`end_time_${index}`}
															type="time"
															value={range.end_time}
															onChange={(e) =>
																onNestedInputChange(
																	`refresh_schedule.time_ranges.${index}.end_time`,
																	e.target.value,
																)
															}
														/>
													</div>
													<div className="space-y-1">
														<Label
															htmlFor={`refresh_rate_${index}`}
															className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
														>
															Rate (s)
														</Label>
														<Input
															id={`refresh_rate_${index}`}
															type="number"
															value={range.refresh_rate}
															onChange={(e) =>
																onNestedInputChange(
																	`refresh_schedule.time_ranges.${index}.refresh_rate`,
																	e.target.value,
																)
															}
														/>
													</div>
												</div>
											),
										)}
									</div>
								) : (
									<p className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
										No custom time ranges configured.
									</p>
								)}
							</div>
						</TabsContent>
					</Tabs>
				</section>
			</div>
		</form>
	);
}

function Field({
	label,
	htmlFor,
	hint,
	error,
	children,
}: {
	label: string;
	htmlFor?: string;
	hint?: string;
	error?: string | null;
	children: React.ReactNode;
}) {
	return (
		<div className="space-y-1.5">
			<Label htmlFor={htmlFor} className="text-xs font-semibold">
				{label}
			</Label>
			{children}
			{hint && !error && (
				<p className="text-[11px] text-muted-foreground">{hint}</p>
			)}
			{error && <p className="text-[11px] text-destructive">{error}</p>}
		</div>
	);
}

function MetaRow({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
				{label}
			</span>
			<span className="truncate text-sm font-medium">{children}</span>
		</div>
	);
}
