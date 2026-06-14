"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createScreenFromRecipe } from "@/app/actions/screens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

type RecipeOption = { id: string; name: string; slug: string };

export function getCreateScreenFormInitialState(recipes: RecipeOption[]) {
	return {
		recipeId: recipes[0]?.id ?? "",
		name: recipes[0]?.name ?? "",
	};
}

export function getScreenNameForRecipe(
	recipes: RecipeOption[],
	recipeId: string,
) {
	return recipes.find((recipe) => recipe.id === recipeId)?.name ?? "";
}

export function selectCreateScreenRecipe(
	recipes: RecipeOption[],
	recipeId: string,
) {
	return {
		recipeId,
		name: getScreenNameForRecipe(recipes, recipeId),
	};
}

export function canSubmitCreateScreenForm({
	isPending,
	recipeId,
	name,
}: {
	isPending: boolean;
	recipeId: string;
	name: string;
}) {
	return !isPending && Boolean(recipeId) && Boolean(name.trim());
}

export async function submitCreateScreenForm({
	recipeId,
	name,
	createScreen = createScreenFromRecipe,
	push,
	notify = toast,
}: {
	recipeId: string;
	name: string;
	createScreen?: typeof createScreenFromRecipe;
	push: (path: string) => void;
	notify?: typeof toast;
}) {
	const result = await createScreen(recipeId, name);
	if (!result.success || !result.screen) {
		notify.error("Could not create screen", { description: result.error });
		return false;
	}

	notify.success("Screen created");
	push(`/screens/${result.screen.id}`);
	return true;
}

export function runCreateScreenSubmit(
	event: Pick<React.FormEvent, "preventDefault">,
	startTransition: (callback: () => void | Promise<void>) => void,
	callback: () => void | Promise<void>,
) {
	event.preventDefault();
	startTransition(callback);
}

export function getCreateScreenSubmitLabel(isPending: boolean) {
	return isPending ? "Creating…" : "Create screen";
}

export function createCreateScreenSubmitAction({
	recipeId,
	name,
	push,
	submit = submitCreateScreenForm,
}: {
	recipeId: string;
	name: string;
	push: (path: string) => void;
	submit?: typeof submitCreateScreenForm;
}) {
	return async () => {
		await submit({
			recipeId,
			name,
			push,
		});
	};
}

export function applyCreateScreenRecipeSelection({
	recipes,
	recipeId,
	setRecipeId,
	setName,
}: {
	recipes: RecipeOption[];
	recipeId: string;
	setRecipeId: (value: string) => void;
	setName: (value: string) => void;
}) {
	const next = selectCreateScreenRecipe(recipes, recipeId);
	setRecipeId(next.recipeId);
	setName(next.name);
}

export function applyCreateScreenNameChange({
	value,
	setName,
}: {
	value: string;
	setName: (value: string) => void;
}) {
	setName(value);
}

export function CreateScreenForm({ recipes }: { recipes: RecipeOption[] }) {
	const router = useRouter();
	const initialState = getCreateScreenFormInitialState(recipes);
	const [recipeId, setRecipeId] = useState(initialState.recipeId);
	const [name, setName] = useState(initialState.name);
	const [isPending, startTransition] = useTransition();

	const submit = (event: React.FormEvent) => {
		runCreateScreenSubmit(
			event,
			startTransition,
			createCreateScreenSubmitAction({
				recipeId,
				name,
				push: router.push,
			}),
		);
	};

	return (
		<form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4">
			<div className="space-y-2">
				<Label>Recipe</Label>
				<Select
					value={recipeId}
					onValueChange={(value) =>
						applyCreateScreenRecipeSelection({
							recipes,
							recipeId: value,
							setRecipeId,
							setName,
						})
					}
				>
					<SelectTrigger>
						<SelectValue placeholder="Select recipe" />
					</SelectTrigger>
					<SelectContent>
						{recipes.map((recipe) => (
							<SelectItem key={recipe.id} value={recipe.id}>
								{recipe.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="space-y-2">
				<Label htmlFor="screen-name">Screen name</Label>
				<Input
					id="screen-name"
					value={name}
					onChange={(event) =>
						applyCreateScreenNameChange({
							value: event.target.value,
							setName,
						})
					}
					placeholder="Calendar — work"
				/>
			</div>
			<Button
				type="submit"
				disabled={
					!canSubmitCreateScreenForm({
						isPending,
						recipeId,
						name,
					})
				}
			>
				{getCreateScreenSubmitLabel(isPending)}
			</Button>
		</form>
	);
}
