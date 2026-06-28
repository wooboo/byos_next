import { z } from "zod";
import {
	DEFAULT_IMAGE_HEIGHT,
	DEFAULT_IMAGE_WIDTH,
} from "@/lib/recipes/constants";
import type { RecipeDefinition } from "@/lib/recipes/types";
import {
	createScreenProfile,
	type ScreenProfile,
} from "@/lib/trmnl/screen-profile";
import { PreSatori } from "@/utils/pre-satori";
import getImmichFavoritesData, { type ImmichFavoritesData } from "./getData";

const DEFAULT_SERVER_URL = "https://immich.lab.zabowka.pl";
const DEFAULT_ROTATION_SECONDS = 300;

export const paramsSchema = z.object({
	orientationFilter: z
		.enum(["any", "portrait", "landscape"])
		.default("any")
		.describe("Limit random favorites by orientation")
		.meta({ title: "Orientation filter" }),
	serverUrl: z
		.string()
		.url()
		.default(DEFAULT_SERVER_URL)
		.describe("Base URL of your Immich instance")
		.meta({
			title: "Immich Server URL",
			placeholder: "https://immich.example.com",
		}),
	apiKey: z
		.string()
		.default("")
		.describe("API key used to fetch favorite photos")
		.meta({ title: "Immich API Key", placeholder: "Immich API key" }),
	photoRotationSeconds: z.coerce
		.number()
		.int()
		.min(0)
		.default(DEFAULT_ROTATION_SECONDS)
		.describe("How often to choose another random favorite photo, in seconds")
		.meta({ title: "Photo rotation seconds" }),
});

export const dataSchema = z.object({
	imageDataUrl: z.string().default(""),
	assetId: z.string().default(""),
	message: z.string().optional(),
});

type ImmichFavoritesProps = {
	width?: number;
	height?: number;
	screen?: ScreenProfile;
	data?: ImmichFavoritesData;
};

export default function ImmichFavorites({
	width: renderWidth = DEFAULT_IMAGE_WIDTH,
	height: renderHeight = DEFAULT_IMAGE_HEIGHT,
	screen,
	data,
}: ImmichFavoritesProps) {
	const screenProfile =
		screen ?? createScreenProfile({ width: renderWidth, height: renderHeight });
	const width = screenProfile.logicalWidth;
	const height = screenProfile.logicalHeight;

	if (!data?.imageDataUrl) {
		return (
			<PreSatori width={width} height={height}>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						width: "100%",
						height: "100%",
						backgroundColor: "#fff",
						alignItems: "center",
						justifyContent: "center",
						fontFamily: "inter",
						color: "#777",
						fontSize: Math.max(14, Math.round(width * 0.026)),
					}}
				>
					<span>{data?.message ?? "No favorite photos in Immich"}</span>
				</div>
			</PreSatori>
		);
	}

	return (
		<PreSatori width={width} height={height}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					width: "100%",
					height: "100%",
					backgroundColor: "#fff",
					position: "relative",
					overflow: "hidden",
				}}
			>
				<img
					src={data.imageDataUrl}
					alt=""
					width={width}
					height={height}
					style={{
						display: "block",
						position: "absolute",
						inset: 0,
						width: "100%",
						height: "100%",
						objectFit: "contain",
					}}
				/>
			</div>
		</PreSatori>
	);
}

export const definition: RecipeDefinition<
	typeof paramsSchema,
	typeof dataSchema
> = {
	meta: {
		slug: "immich-favorites",
		title: "Immich Favorites",
		description:
			"Random favorite photo from Immich. Configure the Immich server URL and API key.",
		published: true,
		tags: ["photos", "immich", "api", "configurable"],
		author: { name: "wooboo", github: "" },
		category: "display-components",
		version: "0.1.0",
		createdAt: "2026-05-24T00:00:00Z",
		updatedAt: "2026-05-24T00:00:00Z",
	},
	paramsSchema,
	dataSchema,
	getData: getImmichFavoritesData,
	Component: ({ width, height, screen, data }) => (
		<ImmichFavorites
			width={width}
			height={height}
			screen={screen}
			data={data}
		/>
	),
};
