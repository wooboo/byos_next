export type RecipeParamType = "string" | "number" | "boolean";

export type RecipeParamDefinition = {
	label: string;
	type: RecipeParamType;
	description?: string;
	default?: unknown;
	placeholder?: string;
};

export type RecipeParamDefinitions = Record<string, RecipeParamDefinition>;
