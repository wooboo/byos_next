import { notFound } from "next/navigation";
import { type ComponentType, cache, Suspense } from "react";
import tools from "@/app/(app)/tools/tools.json";
import BitmapFontDesigner from "@/app/(app)/tools/tools-components/bitmap-font-designer/bitmap-font-designer";
import ImageDitherer from "@/app/(app)/tools/tools-components/image-ditherer/image-ditherer";
import { PageTemplate } from "@/components/common/page-template";

const toolComponents = {
	"bitmap-font-designer": BitmapFontDesigner,
	"image-ditherer": ImageDitherer,
} satisfies Record<keyof typeof tools, ComponentType>;

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const config = tools[slug as keyof typeof tools];

	if (!config) {
		return {
			title: "Tool Not Found",
		};
	}

	return {
		title: config.title,
		description: config.description,
	};
}

// Generate static params for all tools
export async function generateStaticParams() {
	return Object.keys(tools).map((slug) => ({ slug }));
}

// Fetch component for a recipe
const fetchComponent = cache(async (slug: string) => {
	const loadComponent = toolComponents[slug as keyof typeof toolComponents];

	if (!loadComponent) {
		return null;
	}

	return loadComponent;
});

// Dynamic tool component loader
async function ToolComponent({ slug }: { slug: string }) {
	const Component = await fetchComponent(slug);

	if (!Component) {
		return (
			<div className="w-full h-full flex items-center justify-center">
				Component not found
			</div>
		);
	}

	return <Component />;
}

export default async function ToolPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const config = tools[slug as keyof typeof tools];

	console.log(`config: ${config}`);

	if (!config) {
		notFound();
	}

	return (
		<PageTemplate title={config.title} subtitle={config.description}>
			<Suspense fallback={<div>Loading tool...</div>}>
				<ToolComponent slug={slug} />
			</Suspense>
		</PageTemplate>
	);
}
