import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import sharp from "sharp";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/database/db";
import { withExplicitUserScope } from "@/lib/database/scoped-db";
import { checkDbConnection } from "@/lib/database/utils";
import { getLayoutById, type LayoutSlot } from "@/lib/mixup/constants";
import { logger, renderRecipeToImage } from "@/lib/recipes/recipe-renderer";
import { resolveRenderableRef } from "@/lib/screens/render-target";
import type { RgbPalette } from "@/utils/image-processing";
import { DitheringMethod, renderBmp } from "@/utils/render-bmp";
import { binaryImageResponse, parseBitmapOptions } from "../../render-utils";

type SlotAssignment = { type: "recipe" | "screen"; id: string };
type SlotAssignments = Record<string, SlotAssignment | null>;
type MixupSlotRow = {
	slot_id: string;
	recipe_slug: string | null;
	recipe_id: string | null;
	ref_type: string | null;
	ref_id: string | null;
	resolved_slug: string | null;
};
type MixupRenderData = {
	mixup: { layout_id: string } | undefined;
	slots: MixupSlotRow[];
};

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;
		const mixupId = id.replace(".bmp", "");
		const { searchParams } = new URL(req.url);
		const accessToken =
			searchParams.get("access_token") ?? req.headers.get("Access-Token");
		const {
			width,
			height,
			grayscale,
			palette,
			ditherPalette,
			ditherAnchorPalette,
			ditheringMethod,
			bayerPatternSize,
			colorSaturation,
		} = parseBitmapOptions(req);

		const { ready } = await checkDbConnection();
		if (!ready) {
			logger.error("Database not available for mixup rendering");
			return new Response("Database not available", { status: 503 });
		}

		const userIdOrResponse = await resolveMixupUserId(accessToken, mixupId);
		if (userIdOrResponse instanceof Response) {
			return userIdOrResponse;
		}

		const { mixup, slots } = await fetchMixupRenderData(
			userIdOrResponse,
			mixupId,
		);

		if (!mixup) {
			logger.warn(`Mixup not found: ${mixupId}`);
			return new Response("Mixup not found", { status: 404 });
		}

		const layout = getLayoutById(mixup.layout_id, width, height);
		if (!layout) {
			logger.warn(`Invalid layout for mixup ${mixupId}: ${mixup.layout_id}`);
			return new Response("Invalid layout", { status: 400 });
		}

		const assignments = buildSlotAssignments(slots);

		logger.info(
			`Rendering mixup ${mixupId} with layout ${mixup.layout_id} and ${slots.length} slots`,
		);

		// Render the mixup composite
		const compositeBuffer = await renderMixupComposite(
			layout.slots,
			assignments,
			width,
			height,
			grayscale,
			palette,
			ditherPalette,
			ditherAnchorPalette,
			ditheringMethod,
			bayerPatternSize,
			colorSaturation,
			userIdOrResponse,
		);

		return binaryImageResponse(compositeBuffer, "image/bmp");
	} catch (error) {
		logger.error("Error generating mixup image:", error);
		return new Response("Error generating image", { status: 500 });
	}
}

async function resolveMixupUserId(
	accessToken: string | null,
	mixupId: string,
): Promise<string | Response> {
	if (accessToken) {
		return resolveUserIdFromDeviceToken(accessToken);
	}

	if (auth) {
		return resolveUserIdFromSession(auth, mixupId);
	}

	if (process.env.AUTH_ENABLED === "false") {
		return resolveUserIdFromDevMode(mixupId);
	}

	return new Response("Access token is required", { status: 401 });
}

async function resolveUserIdFromDeviceToken(
	accessToken: string,
): Promise<string | Response> {
	const device = await db
		.selectFrom("devices")
		.select(["user_id"])
		.where("api_key", "=", accessToken)
		.executeTakeFirst();

	if (!device?.user_id) {
		return new Response("Mixup not found", { status: 404 });
	}

	// The API key identifies the device owner. The mixup itself is checked
	// below through withExplicitUserScope, so playlist mixup items work too.
	return device.user_id;
}

async function resolveUserIdFromSession(
	authClient: NonNullable<typeof auth>,
	mixupId: string,
): Promise<string | Response> {
	const session = await authClient.api.getSession({
		headers: await headers(),
	});
	if (!session?.user?.id) {
		return new Response("Access token is required", { status: 401 });
	}

	const mixup = await db
		.selectFrom("mixups")
		.select(["user_id"])
		.where("id", "=", mixupId)
		.executeTakeFirst();
	if (!mixup || mixup.user_id !== session.user.id) {
		return new Response("Mixup not found", { status: 404 });
	}

	return session.user.id;
}

async function resolveUserIdFromDevMode(
	mixupId: string,
): Promise<string | Response> {
	const mixup = await db
		.selectFrom("mixups")
		.select(["user_id"])
		.where("id", "=", mixupId)
		.executeTakeFirst();
	if (!mixup?.user_id) {
		return new Response("Mixup not found", { status: 404 });
	}

	return mixup.user_id;
}

async function fetchMixupRenderData(
	userId: string,
	mixupId: string,
): Promise<MixupRenderData> {
	const [mixup, slots] = await withExplicitUserScope(userId, (scopedDb) =>
		Promise.all([
			scopedDb
				.selectFrom("mixups")
				.selectAll()
				.where("id", "=", mixupId)
				.executeTakeFirst(),
			scopedDb
				.selectFrom("mixup_slots")
				.leftJoin("recipes", "recipes.id", "mixup_slots.recipe_id")
				.select([
					"mixup_slots.id",
					"mixup_slots.mixup_id",
					"mixup_slots.slot_id",
					"mixup_slots.recipe_slug",
					"mixup_slots.recipe_id",
					"mixup_slots.ref_type",
					"mixup_slots.ref_id",
					"mixup_slots.order_index",
					"recipes.slug as resolved_slug",
				])
				.where("mixup_slots.mixup_id", "=", mixupId)
				.orderBy("mixup_slots.order_index", "asc")
				.execute(),
		]),
	);

	return { mixup, slots };
}

function buildSlotAssignments(slots: MixupSlotRow[]): SlotAssignments {
	const assignments: SlotAssignments = {};

	for (const slot of slots) {
		assignments[slot.slot_id] = buildSlotAssignment(slot);
	}

	return assignments;
}

function buildSlotAssignment(slot: MixupSlotRow): SlotAssignment | null {
	const refType = slot.ref_type === "screen" ? "screen" : "recipe";
	const refId =
		slot.ref_id ?? slot.recipe_id ?? slot.resolved_slug ?? slot.recipe_slug;

	return refId ? { type: refType, id: refId } : null;
}

/**
 * Render a single recipe slot and return the PNG buffer
 */
async function renderSlot(
	slot: LayoutSlot,
	assignment: SlotAssignment,
	userId: string,
): Promise<Buffer | null> {
	try {
		const target = await resolveRenderableRef({
			type: assignment.type,
			id: assignment.id,
			userId,
		});
		if (!target) return null;
		const renders = await renderRecipeToImage({
			slug: target.recipeSlug,
			imageWidth: slot.width,
			imageHeight: slot.height,
			formats: ["png"],
			userId,
			paramsOverride: target.params,
		});
		return renders.png;
	} catch (error) {
		logger.error(
			`Error rendering slot ${slot.id} with ${assignment.type} ${assignment.id}:`,
			error,
		);
		return null;
	}
}

/**
 * Render all slots and composite them into a final bitmap
 */
async function renderMixupComposite(
	slots: LayoutSlot[],
	assignments: SlotAssignments,
	width: number,
	height: number,
	grayscaleLevels: number,
	palette: RgbPalette | undefined,
	ditherPalette: RgbPalette | undefined,
	ditherAnchorPalette: RgbPalette | undefined,
	ditheringMethod: DitheringMethod | undefined,
	bayerPatternSize: 2 | 4 | 8 | undefined,
	colorSaturation: number | undefined,
	userId: string,
): Promise<Buffer> {
	// Render all slots in parallel
	const slotRenders = await Promise.all(
		slots.map(async (slot) => {
			const assignment = assignments[slot.id];
			if (!assignment) {
				return { slot, buffer: null };
			}

			const buffer = await renderSlot(slot, assignment, userId);
			return { slot, buffer };
		}),
	);

	// Build composite overlays
	const overlays: sharp.OverlayOptions[] = [];

	for (const { slot, buffer } of slotRenders) {
		if (!buffer) continue;

		try {
			// Resize the rendered slot to fit its position on the canvas
			const resizedSlot = await sharp(buffer)
				.resize(slot.width, slot.height, { fit: "cover" })
				.toBuffer();

			overlays.push({
				input: resizedSlot,
				left: slot.x,
				top: slot.y,
			});
		} catch (error) {
			logger.error(`Error resizing slot ${slot.id}:`, error);
		}
	}

	// Create the base canvas and composite all overlays
	const compositedPng = await sharp({
		create: {
			width,
			height,
			channels: 3,
			background: { r: 255, g: 255, b: 255 },
		},
	})
		.composite(overlays)
		.png()
		.toBuffer();

	// Convert to BMP with dithering
	const bmpBuffer = await renderBmp(compositedPng, {
		ditheringMethod: ditheringMethod ?? DitheringMethod.ATKINSON,
		width,
		height,
		grayscale: grayscaleLevels,
		...(bayerPatternSize && { bayerPatternSize }),
		...(palette && { palette }),
		...(ditherPalette && { ditherPalette }),
		...(ditherAnchorPalette && { ditherAnchorPalette }),
		...(colorSaturation !== undefined ? { colorSaturation } : {}),
	});

	return bmpBuffer;
}
