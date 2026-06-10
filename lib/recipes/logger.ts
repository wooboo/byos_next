export const logger = {
	info: (message: string) => {
		if (process.env.NODE_ENV !== "production" || process.env.DEBUG === "true") {
			console.log(message);
		}
	},
	error: (message: string, error?: unknown) => {
		if (error) {
			console.error(message, error);
		} else {
			console.error(message);
		}
	},
	success: (message: string) => {
		if (process.env.NODE_ENV !== "production" || process.env.DEBUG === "true") {
			console.log(`✅ ${message}`);
		}
	},
	warn: (message: string, error?: unknown) => {
		if (process.env.NODE_ENV !== "production" || process.env.DEBUG === "true") {
			if (error) {
				console.warn(message, error);
			} else {
				console.warn(message);
			}
		}
	},
};
