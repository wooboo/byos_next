import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import SystemLogsViewerSkeleton from "./system-logs-viewer-skeleton";

describe("SystemLogsViewerSkeleton", () => {
	it("renders the full loading shell with table rows and pagination placeholders", () => {
		const html = renderToStaticMarkup(
			<SystemLogsViewerSkeleton className="extra-shell" />,
		);

		assert.match(html, /space-y-4 extra-shell/);
		assert.equal((html.match(/<tr class="border-b">/g) ?? []).length, 10);
		assert.match(html, /md:w-\[180px\]/);
		assert.match(html, /h-9 w-20/);
		assert.match(html, /h-9 w-9/);
	});
});
