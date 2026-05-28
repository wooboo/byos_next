"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { renameScreen } from "@/app/actions/screens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ScreenNameForm({
	id,
	initialName,
}: {
	id: string;
	initialName: string;
}) {
	const [name, setName] = useState(initialName);
	const [isPending, startTransition] = useTransition();
	const isDirty = name.trim() !== initialName;

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		startTransition(async () => {
			const result = await renameScreen(id, name);
			if (!result.success) {
				toast.error("Could not rename screen", { description: result.error });
				return;
			}
			toast.success("Screen renamed");
		});
	};

	return (
		<form onSubmit={submit} className="space-y-2 rounded-xl border bg-card p-4">
			<Label htmlFor="screen-name">Screen name</Label>
			<div className="flex gap-2">
				<Input
					id="screen-name"
					value={name}
					onChange={(event) => setName(event.target.value)}
				/>
				<Button type="submit" disabled={isPending || !isDirty || !name.trim()}>
					{isPending ? "Saving…" : "Rename"}
				</Button>
			</div>
		</form>
	);
}
