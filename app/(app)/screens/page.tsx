import Image from "next/image";
import Link from "next/link";
import { listScreens } from "@/app/actions/screens";
import { PageTemplate } from "@/components/common/page-template";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ScreensPage() {
	const screens = await listScreens();
	return (
		<PageTemplate
			title="Screens"
			subtitle="Configured screen instances ready for devices, playlists, and mixups."
			left={
				<Button asChild>
					<Link href="/screens/new">New screen</Link>
				</Button>
			}
		>
			{screens.length === 0 ? (
				<Card>
					<CardContent className="p-8 text-sm text-muted-foreground">
						No screens yet. Create one by assigning a recipe from a device,
						playlist, mixup, or convert a legacy recipe.
					</CardContent>
				</Card>
			) : (
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{screens.map((screen) => (
						<Card key={screen.id} className="overflow-hidden">
							<div className="aspect-video bg-muted">
								<Image
									src={`/api/bitmap/screen/${screen.id}.bmp?width=400&height=240&grayscale=16`}
									alt={screen.name}
									width={400}
									height={240}
									className="h-full w-full object-contain"
									unoptimized
								/>
							</div>
							<CardHeader>
								<CardTitle className="text-base">{screen.name}</CardTitle>
								<div className="text-xs text-muted-foreground">
									Recipe: {screen.recipe_name}
								</div>
							</CardHeader>
							<CardContent className="mt-auto">
								<Button asChild size="sm">
									<Link href={`/screens/${screen.id}`}>Edit</Link>
								</Button>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</PageTemplate>
	);
}
