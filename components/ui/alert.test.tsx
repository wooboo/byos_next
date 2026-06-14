import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import { Alert, AlertDescription, AlertTitle } from "./alert";

describe("Alert", () => {
	it("renders alert slots, role, and variant classes", () => {
		const html = renderToStaticMarkup(
			<Alert variant="destructive" className="custom-alert">
				<AlertTitle>Heads up</AlertTitle>
				<AlertDescription>Something needs attention.</AlertDescription>
			</Alert>,
		);

		assert.match(html, /data-slot="alert"/);
		assert.match(html, /role="alert"/);
		assert.match(html, /custom-alert/);
		assert.match(html, /data-slot="alert-title"/);
		assert.match(html, /Heads up/);
		assert.match(html, /data-slot="alert-description"/);
		assert.match(html, /Something needs attention/);
		assert.match(html, /text-destructive/);
	});
});
