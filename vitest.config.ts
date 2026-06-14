import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@": rootDir,
		},
	},
	test: {
		coverage: {
			exclude: ["**/*.d.ts", "**/*.test.ts", "**/*.test.tsx", "tests/**"],
			include: [
				"app/**/*.ts",
				"app/**/*.tsx",
				"components/**/*.ts",
				"components/**/*.tsx",
				"lib/**/*.ts",
				"utils/**/*.ts",
				"utils/**/*.tsx",
				"hooks/**/*.ts",
			],
			provider: "v8",
			reporter: ["text"],
			thresholds: {
				branches: 80,
				functions: 80,
				lines: 80,
				statements: 80,
			},
		},
		environment: "node",
		exclude: ["node_modules", ".next", "dist"],
		include: ["**/*.test.ts", "**/*.test.tsx"],
		setupFiles: ["./vitest.setup.ts"],
	},
});
