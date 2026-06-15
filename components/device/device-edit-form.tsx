"use client";

import { Check, ChevronsUpDown, RefreshCw, Search } from "lucide-react";
import Image from "next/image";
import type React from "react";
import { DeviceFrame } from "@/components/common/device-frame";
import { ScaledReactPreview } from "@/components/preview/scaled-react-preview";
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
import { playlistFrameBmpUrl, playlistFramePngUrl } from "@/lib/playlist-url";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
} from "@/lib/recipes/constants";
import type { Device, Mixup, Playlist } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatTimezone, timezones } from "@/utils/helpers";

export const DEVICE_SIZE_PRESETS = {
	"800x480": { width: 800, height: 480 },
	"600x400": { width: 600, height: 400 },
	"1872x1404": { width: 1872, height: 1404 },
	"2048x1536": { width: 2048, height: 1536 },
	custom: null,
} as const;

type DeviceSizePreset = keyof typeof DEVICE_SIZE_PRESETS;
type DeviceEditData = Device & { status?: string; type?: string };
type ScreenOption = { id: string; title: string };
type RecipeOption = { id: string; title: string };
type PlaylistPreviewFrame = {
	screen: string;
	screen_type?: string | null;
	duration: number;
};

interface DeviceEditFormProps {
	editedDevice: DeviceEditData;
	availableScreens: ScreenOption[];
	availableRecipes: RecipeOption[];
	availablePlaylists: Playlist[];
	availableMixups: Mixup[];
	playlistScreens: PlaylistPreviewFrame[];
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

export function getDeviceGrayscale(editedDevice: DeviceEditData) {
	return editedDevice.grayscale === 2 ||
		editedDevice.grayscale === 4 ||
		editedDevice.grayscale === 16 ||
		editedDevice.grayscale === 256
		? editedDevice.grayscale
		: 16;
}

export function getSelectedContent({
	editedDevice,
	availableScreens,
	availableRecipes,
	availablePlaylists,
	availableMixups,
}: Pick<
	DeviceEditFormProps,
	| "editedDevice"
	| "availableScreens"
	| "availableRecipes"
	| "availablePlaylists"
	| "availableMixups"
>) {
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
	const value = isPlaylist
		? `playlist:${editedDevice.playlist_id}`
		: isMixup
			? `mixup:${editedDevice.mixup_id}`
			: legacySingleScreenId
				? `${legacySingleScreenType}:${legacySingleScreenId}`
				: "none";
	const label =
		value === "none"
			? "None (use default)"
			: value.startsWith("recipe:")
				? availableRecipes.find((recipe) => `recipe:${recipe.id}` === value)
						?.title
				: value.startsWith("screen:")
					? availableScreens.find((screen) => `screen:${screen.id}` === value)
							?.title
					: value.startsWith("playlist:")
						? availablePlaylists.find(
								(playlist) => `playlist:${playlist.id}` === value,
							)?.name
						: availableMixups.find((mixup) => `mixup:${mixup.id}` === value)
								?.name;

	return {
		isPlaylist,
		isMixup,
		legacySingleScreenId,
		value,
		label,
	};
}

export function getPreviewSources({
	editedDevice,
	isMixup,
	isPlaylist,
	legacySingleScreenId,
	playlistScreens,
	previewWidth,
	previewHeight,
	grayscale,
}: {
	editedDevice: DeviceEditData;
	isMixup: boolean;
	isPlaylist: boolean;
	legacySingleScreenId: string | null;
	playlistScreens: PlaylistPreviewFrame[];
	previewWidth: number;
	previewHeight: number;
	grayscale: number;
}) {
	const playlistPreviewFrame = isPlaylist ? playlistScreens[0] : null;
	const previewId =
		playlistPreviewFrame?.screen ||
		(isMixup ? editedDevice.mixup_id : legacySingleScreenId) ||
		"simple-text";
	const previewFrameType = playlistPreviewFrame
		? playlistPreviewFrame.screen_type || "recipe"
		: isMixup
			? "mixup"
			: editedDevice.screen_type;
	const previewType =
		previewFrameType === "mixup"
			? "mixup"
			: resolveRenderableContentType(previewFrameType, previewId);
	const heroSrc =
		previewType === "mixup"
			? `/api/bitmap/mixup/${previewId}.bmp?width=${previewWidth}&height=${previewHeight}&grayscale=${grayscale}`
			: playlistFrameBmpUrl(
					previewId,
					previewType,
					previewWidth,
					previewHeight,
					grayscale,
				);

	return {
		playlistPreviewFrame,
		previewType,
		heroSrc,
		pngSrc: playlistFramePngUrl(
			previewId,
			previewType,
			previewWidth,
			previewHeight,
		),
		reactSrc: `/preview/${previewType}/${previewId}?width=${previewWidth}&height=${previewHeight}`,
	};
}

export default function DeviceEditForm({
	editedDevice,
	availableScreens,
	availableRecipes,
	availablePlaylists,
	availableMixups,
	playlistScreens,
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
	const previewWidth = preview.width;
	const previewHeight = preview.height;
	const deviceGrayscale = getDeviceGrayscale(editedDevice);
	const selectedContent = getSelectedContent({
		editedDevice,
		availableScreens,
		availableRecipes,
		availablePlaylists,
		availableMixups,
	});
	const previewSources = getPreviewSources({
		editedDevice,
		isMixup: selectedContent.isMixup,
		isPlaylist: selectedContent.isPlaylist,
		legacySingleScreenId: selectedContent.legacySingleScreenId,
		playlistScreens,
		previewWidth,
		previewHeight,
		grayscale: preview.grayscale,
	});

	return (
		<form onSubmit={onSubmit}>
			<div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
				<DevicePreviewPanel
					editedDevice={editedDevice}
					isPlaylist={selectedContent.isPlaylist}
					preview={preview}
					previewSources={previewSources}
				/>

				<ConfigurationPanel
					editedDevice={editedDevice}
					availableScreens={availableScreens}
					availableRecipes={availableRecipes}
					availablePlaylists={availablePlaylists}
					availableMixups={availableMixups}
					selectedContent={selectedContent}
					deviceSizePreset={deviceSizePreset}
					deviceGrayscale={deviceGrayscale}
					apiKeyError={apiKeyError}
					friendlyIdError={friendlyIdError}
					onInputChange={onInputChange}
					onNestedInputChange={onNestedInputChange}
					onSelectChange={onSelectChange}
					onContentRefChange={onContentRefChange}
					onDeviceSizePresetChange={onDeviceSizePresetChange}
					onCustomSizeChange={onCustomSizeChange}
					onRegenerateApiKey={onRegenerateApiKey}
					onRegenerateFriendlyId={onRegenerateFriendlyId}
					onAddTimeRange={onAddTimeRange}
				/>
			</div>
		</form>
	);
}

function ConfigurationPanel({
	editedDevice,
	availableScreens,
	availableRecipes,
	availablePlaylists,
	availableMixups,
	selectedContent,
	deviceSizePreset,
	deviceGrayscale,
	apiKeyError,
	friendlyIdError,
	onInputChange,
	onNestedInputChange,
	onSelectChange,
	onContentRefChange,
	onDeviceSizePresetChange,
	onCustomSizeChange,
	onRegenerateApiKey,
	onRegenerateFriendlyId,
	onAddTimeRange,
}: Pick<
	DeviceEditFormProps,
	| "editedDevice"
	| "availableScreens"
	| "availableRecipes"
	| "availablePlaylists"
	| "availableMixups"
	| "deviceSizePreset"
	| "apiKeyError"
	| "friendlyIdError"
	| "onInputChange"
	| "onNestedInputChange"
	| "onSelectChange"
	| "onContentRefChange"
	| "onDeviceSizePresetChange"
	| "onCustomSizeChange"
	| "onRegenerateApiKey"
	| "onRegenerateFriendlyId"
	| "onAddTimeRange"
> & {
	selectedContent: ReturnType<typeof getSelectedContent>;
	deviceGrayscale: number;
}) {
	return (
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
					<EssentialsTab
						editedDevice={editedDevice}
						apiKeyError={apiKeyError}
						friendlyIdError={friendlyIdError}
						onInputChange={onInputChange}
						onSelectChange={onSelectChange}
						onRegenerateApiKey={onRegenerateApiKey}
						onRegenerateFriendlyId={onRegenerateFriendlyId}
					/>
				</TabsContent>

				<TabsContent value="content" className="mt-4 space-y-4">
					<ContentPicker
						availableScreens={availableScreens}
						availableRecipes={availableRecipes}
						availablePlaylists={availablePlaylists}
						availableMixups={availableMixups}
						selectedContent={selectedContent}
						onContentRefChange={onContentRefChange}
					/>
				</TabsContent>

				<TabsContent value="display" className="mt-4 space-y-4">
					<DisplayTab
						editedDevice={editedDevice}
						deviceSizePreset={deviceSizePreset}
						deviceGrayscale={deviceGrayscale}
						onSelectChange={onSelectChange}
						onDeviceSizePresetChange={onDeviceSizePresetChange}
						onCustomSizeChange={onCustomSizeChange}
					/>
				</TabsContent>

				<TabsContent value="refresh" className="mt-4 space-y-4">
					<RefreshScheduleFields
						editedDevice={editedDevice}
						onInputChange={onInputChange}
						onNestedInputChange={onNestedInputChange}
						onAddTimeRange={onAddTimeRange}
					/>
				</TabsContent>
			</Tabs>
		</section>
	);
}

function EssentialsTab({
	editedDevice,
	apiKeyError,
	friendlyIdError,
	onInputChange,
	onSelectChange,
	onRegenerateApiKey,
	onRegenerateFriendlyId,
}: Pick<
	DeviceEditFormProps,
	| "editedDevice"
	| "apiKeyError"
	| "friendlyIdError"
	| "onInputChange"
	| "onSelectChange"
	| "onRegenerateApiKey"
	| "onRegenerateFriendlyId"
>) {
	return (
		<>
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
			<Field label="Friendly ID" htmlFor="friendly_id" error={friendlyIdError}>
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
			<TimezoneField
				timezone={editedDevice?.timezone}
				onSelectChange={onSelectChange}
			/>
		</>
	);
}

function TimezoneField({
	timezone,
	onSelectChange,
}: {
	timezone?: string | null;
	onSelectChange: DeviceEditFormProps["onSelectChange"];
}) {
	return (
		<Field label="Timezone" htmlFor="timezone">
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						className="w-full justify-between font-normal"
					>
						{timezone ? formatTimezone(timezone) : "Select timezone…"}
						<Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-[300px] p-0">
					<Command>
						<CommandInput placeholder="Search timezone…" />
						<CommandEmpty>No timezone found.</CommandEmpty>
						<CommandList>
							<ScrollArea className="h-[300px]">
								{["Europe", "North America", "Asia", "Australia & Pacific"].map(
									(region) => (
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
																timezone === tz.value && "font-medium",
															)}
														>
															{tz.label}
														</span>
													</CommandItem>
												))}
										</CommandGroup>
									),
								)}
							</ScrollArea>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</Field>
	);
}

function DisplayTab({
	editedDevice,
	deviceSizePreset,
	deviceGrayscale,
	onSelectChange,
	onDeviceSizePresetChange,
	onCustomSizeChange,
}: Pick<
	DeviceEditFormProps,
	| "editedDevice"
	| "deviceSizePreset"
	| "onSelectChange"
	| "onDeviceSizePresetChange"
	| "onCustomSizeChange"
> & {
	deviceGrayscale: number;
}) {
	return (
		<>
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
						<SelectItem value="600x400">600 × 400</SelectItem>
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
									Number.parseInt(e.target.value, 10) || DEFAULT_IMAGE_WIDTH,
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
							value={editedDevice?.screen_height || DEFAULT_IMAGE_HEIGHT}
							onChange={(e) =>
								onCustomSizeChange(
									"height",
									Number.parseInt(e.target.value, 10) || DEFAULT_IMAGE_HEIGHT,
								)
							}
						/>
					</Field>
				</div>
			)}

			<Field label="Orientation" htmlFor="screen_orientation">
				<Select
					value={editedDevice?.screen_orientation || "landscape"}
					onValueChange={(value) => onSelectChange("screen_orientation", value)}
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
					className="grid w-fit grid-cols-4"
				>
					<ToggleGroupItem value="2">2</ToggleGroupItem>
					<ToggleGroupItem value="4">4</ToggleGroupItem>
					<ToggleGroupItem value="16">16</ToggleGroupItem>
					<ToggleGroupItem value="256">256 colors</ToggleGroupItem>
				</ToggleGroup>
			</Field>
		</>
	);
}

function DevicePreviewPanel({
	editedDevice,
	isPlaylist,
	preview,
	previewSources,
}: {
	editedDevice: DeviceEditData;
	isPlaylist: boolean;
	preview: ReturnType<typeof useScreenPreviewControls>;
	previewSources: ReturnType<typeof getPreviewSources>;
}) {
	return (
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
				reactMode={preview.reactMode}
				onReactModeChange={preview.setReactMode}
				className="border-b bg-muted/20 px-3"
			/>
			<div className="flex flex-1 items-center justify-center bg-[radial-gradient(circle_at_50%_0%,theme(colors.muted/40),transparent_70%)] p-6">
				{isPlaylist && !previewSources.playlistPreviewFrame ? (
					<div className="text-center text-sm text-muted-foreground">
						This playlist does not have any frames yet.
					</div>
				) : previewSources.previewType === "mixup" &&
					preview.format !== "bmp" ? (
					<div className="text-center text-sm text-muted-foreground">
						{preview.format.toUpperCase()} preview is not available for mixups
						yet.
					</div>
				) : (
					<div
						className={cn(
							"w-full",
							preview.isPortrait ? "max-w-[260px]" : "max-w-[520px]",
						)}
					>
						<DeviceFrame
							size="lg"
							portrait={preview.isPortrait}
							screenWidth={preview.width}
							screenHeight={preview.height}
						>
							{preview.format === "react" ? (
								<ScaledReactPreview
									title="Device React preview"
									src={previewSources.reactSrc}
									width={preview.width}
									height={preview.height}
									mode={preview.reactMode}
								/>
							) : (
								<Image
									src={
										preview.format === "png"
											? previewSources.pngSrc
											: previewSources.heroSrc
									}
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
							width: preview.width,
							height: preview.height,
							grayscale: preview.grayscale,
							reactMode: preview.reactMode,
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
	);
}

function ContentPicker({
	availableScreens,
	availableRecipes,
	availablePlaylists,
	availableMixups,
	selectedContent,
	onContentRefChange,
}: Pick<
	DeviceEditFormProps,
	| "availableScreens"
	| "availableRecipes"
	| "availablePlaylists"
	| "availableMixups"
	| "onContentRefChange"
> & {
	selectedContent: ReturnType<typeof getSelectedContent>;
}) {
	return (
		<Field label="Content" hint="Choose what this device should render.">
			<Popover>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						className="w-full justify-between"
					>
						<span className="truncate">
							{selectedContent.label || "Search or select content…"}
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
							<ContentPickerGroup
								heading="Recipes"
								items={availableRecipes}
								kind="recipe"
								selectedValue={selectedContent.value}
								onContentRefChange={onContentRefChange}
							/>
							<ContentPickerGroup
								heading="Screens"
								items={availableScreens}
								kind="screen"
								selectedValue={selectedContent.value}
								onContentRefChange={onContentRefChange}
							/>
							<ContentPickerGroup
								heading="Playlists"
								items={availablePlaylists}
								kind="playlist"
								selectedValue={selectedContent.value}
								onContentRefChange={onContentRefChange}
							/>
							<ContentPickerGroup
								heading="Mixups"
								items={availableMixups}
								kind="mixup"
								selectedValue={selectedContent.value}
								onContentRefChange={onContentRefChange}
							/>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		</Field>
	);
}

function ContentPickerGroup({
	heading,
	items,
	kind,
	selectedValue,
	onContentRefChange,
}: {
	heading: string;
	items: Array<ScreenOption | RecipeOption | Playlist | Mixup>;
	kind: "recipe" | "screen" | "playlist" | "mixup";
	selectedValue: string;
	onContentRefChange: DeviceEditFormProps["onContentRefChange"];
}) {
	return (
		<CommandGroup heading={heading}>
			{items.map((item) => {
				const label = "title" in item ? item.title : item.name;
				const value = `${kind}:${item.id}`;
				return (
					<CommandItem
						key={value}
						value={`${kind} ${label}`}
						onSelect={() => onContentRefChange(kind, item.id)}
					>
						<Check
							className={cn(
								"mr-2 h-4 w-4",
								selectedValue === value ? "opacity-100" : "opacity-0",
							)}
						/>
						{label}
					</CommandItem>
				);
			})}
		</CommandGroup>
	);
}

function RefreshScheduleFields({
	editedDevice,
	onInputChange,
	onNestedInputChange,
	onAddTimeRange,
}: Pick<
	DeviceEditFormProps,
	"editedDevice" | "onInputChange" | "onNestedInputChange" | "onAddTimeRange"
>) {
	return (
		<>
			<Field
				label="Default refresh rate"
				htmlFor="refresh_schedule.default_refresh_rate"
				hint="Seconds between refreshes when no time range applies."
			>
				<Input
					id="refresh_schedule.default_refresh_rate"
					name="refresh_schedule.default_refresh_rate"
					type="number"
					value={editedDevice?.refresh_schedule?.default_refresh_rate || 300}
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
						{editedDevice.refresh_schedule.time_ranges.map((range, index) => (
							<TimeRangeFields
								key={index}
								index={index}
								range={range}
								onNestedInputChange={onNestedInputChange}
							/>
						))}
					</div>
				) : (
					<p className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
						No custom time ranges configured.
					</p>
				)}
			</div>
		</>
	);
}

function TimeRangeFields({
	index,
	range,
	onNestedInputChange,
}: {
	index: number;
	range: NonNullable<Device["refresh_schedule"]>["time_ranges"][number];
	onNestedInputChange: DeviceEditFormProps["onNestedInputChange"];
}) {
	return (
		<div className="grid grid-cols-3 gap-2 p-3">
			<TimeRangeInput
				id={`start_time_${index}`}
				label="Start"
				type="time"
				value={range.start_time}
				onChange={(value) =>
					onNestedInputChange(
						`refresh_schedule.time_ranges.${index}.start_time`,
						value,
					)
				}
			/>
			<TimeRangeInput
				id={`end_time_${index}`}
				label="End"
				type="time"
				value={range.end_time}
				onChange={(value) =>
					onNestedInputChange(
						`refresh_schedule.time_ranges.${index}.end_time`,
						value,
					)
				}
			/>
			<TimeRangeInput
				id={`refresh_rate_${index}`}
				label="Rate (s)"
				type="number"
				value={range.refresh_rate}
				onChange={(value) =>
					onNestedInputChange(
						`refresh_schedule.time_ranges.${index}.refresh_rate`,
						value,
					)
				}
			/>
		</div>
	);
}

function TimeRangeInput({
	id,
	label,
	type,
	value,
	onChange,
}: {
	id: string;
	label: string;
	type: React.HTMLInputTypeAttribute;
	value: string | number;
	onChange: (value: string) => void;
}) {
	return (
		<div className="space-y-1">
			<Label
				htmlFor={id}
				className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
			>
				{label}
			</Label>
			<Input
				id={id}
				type={type}
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
		</div>
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
