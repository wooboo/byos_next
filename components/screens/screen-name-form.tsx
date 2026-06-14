"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { renameScreen } from "@/app/actions/screens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function isScreenNameDirty(name: string, initialName: string) {
	return name.trim() !== initialName;
}

export function canSubmitScreenNameForm({
	isPending,
	name,
	initialName,
}: {
	isPending: boolean;
	name: string;
	initialName: string;
}) {
	return (
		!isPending && isScreenNameDirty(name, initialName) && Boolean(name.trim())
	);
}

export async function submitScreenNameForm({
	id,
	name,
	rename = renameScreen,
	notify = toast,
}: {
	id: string;
	name: string;
	rename?: typeof renameScreen;
	notify?: typeof toast;
}) {
	const result = await rename(id, name);
	if (!result.success) {
		notify.error("Could not rename screen", { description: result.error });
		return false;
	}

	notify.success("Screen renamed");
	return true;
}

export function runScreenNameSubmit(
	event: Pick<React.FormEvent, "preventDefault">,
	startTransition: (callback: () => void | Promise<void>) => void,
	callback: () => void | Promise<void>,
) {
	event.preventDefault();
	startTransition(callback);
}

export function getScreenNameSubmitLabel(isPending: boolean) {
	return isPending ? "Saving…" : "Rename";
}

export function ScreenNameForm({
	id,
	initialName,
}: {
	id: string;
	initialName: string;
}) {
	const [name, setName] = useState(initialName);
	const [isPending, startTransition] = useTransition();

	const submit = (event: React.FormEvent) => {
		runScreenNameSubmit(event, startTransition, async () => {
			await submitScreenNameForm({
				id,
				name,
			});
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
				<Button
					type="submit"
					disabled={
						!canSubmitScreenNameForm({
							isPending,
							name,
							initialName,
						})
					}
				>
					{getScreenNameSubmitLabel(isPending)}
				</Button>
			</div>
		</form>
	);
}
