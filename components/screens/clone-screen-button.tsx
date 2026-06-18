"use client";

import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cloneScreen } from "@/app/actions/screens";
import { Button } from "@/components/ui/button";

export function CloneScreenButton({ id }: { id: string }) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	return (
		<Button
			variant="outline"
			size="sm"
			className="gap-1"
			disabled={isPending}
			onClick={() => {
				startTransition(async () => {
					const result = await cloneScreen(id);
					if (result.success && result.screen?.id) {
						router.push(`/screens/${result.screen.id}`);
					}
				});
			}}
		>
			<Copy className="h-4 w-4" />
			{isPending ? "Cloning..." : "Clone"}
		</Button>
	);
}
