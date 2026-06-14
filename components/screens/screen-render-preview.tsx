import Link from "next/link";
import { RecipePreviewStage } from "@/components/recipes/recipe-preview-stage";

export function ScreenRenderPreview({
	screenId,
	recipeSlug,
	isPortrait,
}: {
	screenId: string;
	recipeSlug: string;
	title: string;
	isPortrait: boolean;
	imageWidth: number;
	imageHeight: number;
	paramsOverride: Record<string, unknown>;
	userId?: string | null;
}) {
	return (
		<RecipePreviewStage
			slug={recipeSlug}
			basePath={`/screens/${screenId}`}
			bitmapUrl={`/api/bitmap/${recipeSlug}/${screenId}.bmp`}
			pngUrl={`/api/png/${recipeSlug}/${screenId}.png`}
			isPortrait={isPortrait}
			reactPreviewSrc={`/preview/screen/${screenId}`}
			bmpPipeline={
				<span>
					JSX → screen params → browser PNG → render-bmp →{" "}
					<Link href={`/api/bitmap/${recipeSlug}/${screenId}.bmp`}>
						/api/bitmap/{recipeSlug}/{screenId}.bmp
					</Link>
				</span>
			}
			pngPipeline={
				<span>
					JSX → screen params → browser PNG →{" "}
					<Link href={`/api/png/${recipeSlug}/${screenId}.png`}>
						/api/png/{recipeSlug}/{screenId}.png
					</Link>
				</span>
			}
			reactPipeline={<span>JSX → screen params → React preview</span>}
		/>
	);
}
