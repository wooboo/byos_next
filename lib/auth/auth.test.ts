import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ResetPasswordHandler = (input: {
	user: { email: string };
	url: string;
}) => Promise<void>;

type BeforeCreateUserHook = (user: {
	email: string;
	role?: string;
}) => Promise<{ data: { email: string; role?: string } }>;

type AuthConfig = {
	database: unknown;
	trustedOrigins: string[];
	emailAndPassword: {
		enabled: boolean;
		sendResetPassword: ResetPasswordHandler;
	};
	plugins: unknown[];
	databaseHooks: {
		user: {
			create: {
				before: BeforeCreateUserHook;
			};
		};
	};
};

const state = vi.hoisted(() => ({
	admin: vi.fn(),
	betterAuth: vi.fn(),
	getLanTrustedOrigins: vi.fn(),
	pool: vi.fn(),
	sendEmail: vi.fn(),
}));

vi.mock("better-auth", () => ({
	betterAuth: state.betterAuth,
}));

vi.mock("better-auth/plugins", () => ({
	admin: state.admin,
}));

vi.mock("pg", () => ({
	Pool: class {
		kind = "pool";

		constructor(options: { connectionString?: string }) {
			state.pool(options);
		}
	},
}));

vi.mock("@/lib/email", () => ({
	sendEmail: state.sendEmail,
}));

vi.mock("@/lib/lan-origins", () => ({
	getLanTrustedOrigins: state.getLanTrustedOrigins,
}));

const loadAuth = async ({
	adminEmail,
	authEnabled = "true",
}: {
	adminEmail?: string;
	authEnabled?: string;
} = {}) => {
	vi.resetModules();
	vi.stubEnv("AUTH_ENABLED", authEnabled);
	vi.stubEnv("DATABASE_URL", "postgres://byos:test@localhost/byos");
	if (adminEmail) {
		vi.stubEnv("ADMIN_EMAIL", adminEmail);
	}

	state.betterAuth.mockReturnValue({ kind: "auth-instance" });
	state.admin.mockReturnValue({ kind: "admin-plugin" });
	state.getLanTrustedOrigins.mockReturnValue(["http://byos.local"]);

	return import("./auth");
};

describe("auth", () => {
	beforeEach(() => {
		state.admin.mockReset();
		state.betterAuth.mockReset();
		state.getLanTrustedOrigins.mockReset();
		state.pool.mockReset();
		state.sendEmail.mockReset();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it("exports null and avoids initialization when auth is disabled", async () => {
		const { auth } = await loadAuth({ authEnabled: "false" });

		expect(auth).toBeNull();
		expect(state.pool).not.toHaveBeenCalled();
		expect(state.betterAuth).not.toHaveBeenCalled();
	});

	it("initializes Better Auth with database, origins, password email, and admin plugin", async () => {
		const { auth } = await loadAuth({ adminEmail: "admin@example.com" });

		expect(auth).toEqual({ kind: "auth-instance" });
		expect(state.pool).toHaveBeenCalledWith({
			connectionString: "postgres://byos:test@localhost/byos",
		});
		expect(state.getLanTrustedOrigins).toHaveBeenCalled();
		expect(state.admin).toHaveBeenCalledWith({
			defaultRole: "user",
			adminRoles: ["admin"],
		});

		const config = state.betterAuth.mock.calls[0]?.[0] as AuthConfig;
		expect(config.database).toMatchObject({ kind: "pool" });
		expect(config.trustedOrigins).toEqual(["http://byos.local"]);
		expect(config.emailAndPassword.enabled).toBe(true);
		expect(config.plugins).toEqual([{ kind: "admin-plugin" }]);
	});

	it("sends password reset email through the email boundary", async () => {
		await loadAuth();
		const config = state.betterAuth.mock.calls[0]?.[0] as AuthConfig;

		await config.emailAndPassword.sendResetPassword({
			user: { email: "user@example.com" },
			url: "https://example.test/reset",
		});

		expect(state.sendEmail).toHaveBeenCalledWith({
			to: "user@example.com",
			subject: "Reset your password",
			text: "Click the link to reset your password: https://example.test/reset",
			html: expect.stringContaining("https://example.test/reset"),
		});
	});

	it("promotes the configured admin email when a user is created", async () => {
		await loadAuth({ adminEmail: "admin@example.com" });
		const config = state.betterAuth.mock.calls[0]?.[0] as AuthConfig;

		await expect(
			config.databaseHooks.user.create.before({
				email: "admin@example.com",
			}),
		).resolves.toEqual({
			data: {
				email: "admin@example.com",
				role: "admin",
			},
		});
	});

	it("keeps non-admin users unchanged during creation", async () => {
		await loadAuth({ adminEmail: "admin@example.com" });
		const config = state.betterAuth.mock.calls[0]?.[0] as AuthConfig;

		await expect(
			config.databaseHooks.user.create.before({
				email: "user@example.com",
				role: "user",
			}),
		).resolves.toEqual({
			data: {
				email: "user@example.com",
				role: "user",
			},
		});
	});
});
