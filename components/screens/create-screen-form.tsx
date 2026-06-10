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

export function CreateScreenForm({ recipes }: { recipes: RecipeOption[] }) {
	const router = useRouter();
	const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
	const [name, setName] = useState(recipes[0]?.name ?? "");
	const [isPending, startTransition] = useTransition();

	const submit = (event: React.FormEvent) => {
		event.preventDefault();
		startTransition(async () => {
			const result = await createScreenFromRecipe(recipeId, name);
			if (!result.success || !result.screen) {
				toast.error("Could not create screen", { description: result.error });
				return;
			}
			toast.success("Screen created");
			router.push(`/screens/${result.screen.id}`);
		});
	};

	return (
		<form onSubmit={submit} className="space-y-4 rounded-xl border bg-card p-4">
			<div className="space-y-2">
				<Label>Recipe</Label>
				<Select
					value={recipeId}
					onValueChange={(value) => {
						setRecipeId(value);
						setName(recipes.find((recipe) => recipe.id === value)?.name ?? "");
					}}
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
					onChange={(event) => setName(event.target.value)}
					placeholder="Calendar — work"
				/>
			</div>
			<Button type="submit" disabled={isPending || !recipeId || !name.trim()}>
				{isPending ? "Creating…" : "Create screen"}
			</Button>
		</form>
	);
}
