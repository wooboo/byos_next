"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteScreen } from "@/app/actions/screens";
import { Button } from "@/components/ui/button";

export function DeleteScreenButton({ id, name }: { id: string; name: string }) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	return (
		<Button
			variant="outline"
			size="sm"
			className="gap-1 text-destructive hover:text-destructive"
			disabled={isPending}
			onClick={() => {
				if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
				startTransition(async () => {
					const result = await deleteScreen(id);
					if (result.success) router.push("/screens");
				});
			}}
		>
			<Trash2 className="h-4 w-4" />
			{isPending ? "Deleting..." : "Delete"}
		</Button>
	);
}
