"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { deleteDevice } from "@/app/actions/device";
import { Button } from "@/components/ui/button";

export function DeleteDeviceButton({
	friendlyId,
	name,
}: {
	friendlyId: string;
	name: string;
}) {
	const [isPending, startTransition] = useTransition();

	return (
		<Button
			variant="outline"
			size="sm"
			className="gap-1 text-destructive hover:text-destructive"
			disabled={isPending}
			onClick={() => {
				if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
				startTransition(() => deleteDevice(friendlyId));
			}}
		>
			<Trash2 className="h-4 w-4" />
			{isPending ? "Deleting..." : "Delete"}
		</Button>
	);
}
