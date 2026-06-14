import { afterEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./email";

describe("sendEmail", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("logs the outgoing email payload and resolves", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

		await expect(
			sendEmail({
				to: "user@example.com",
				subject: "Reset",
				text: "Click here",
			}),
		).resolves.toBeUndefined();

		expect(logSpy.mock.calls).toEqual([
			["📧 Email would be sent:"],
			["To:", "user@example.com"],
			["Subject:", "Reset"],
			["Content:", "Click here"],
			["---"],
		]);
	});
});
