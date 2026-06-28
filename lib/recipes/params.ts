export type RecipeParamType = "string" | "number" | "boolean";

export type RecipeParamOption = {
	label: string;
	value: string;
};

export type RecipeParamDefinition = {
	label: string;
	type: RecipeParamType;
	description?: string;
	default?: unknown;
	placeholder?: string;
	options?: Array<string | RecipeParamOption>;
};

export type RecipeParamDefinitions = Record<string, RecipeParamDefinition>;
