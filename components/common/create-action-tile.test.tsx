import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import { CreateActionTile } from "./create-action-tile";

describe("CreateActionTile", () => {
	it("renders the title, description, icon wrapper, and optional action label", () => {
		const html = renderToStaticMarkup(
			<CreateActionTile
				icon={<span>+</span>}
				title="New playlist"
				description="Start a new reel from scratch"
				actionLabel={<span>Create now</span>}
				className="tile"
				iconClassName="icon-shell"
			/>,
		);

		assert.match(html, /class="[^"]*tile/);
		assert.match(html, /class="[^"]*icon-shell/);
		assert.match(html, />New playlist</);
		assert.match(html, /Start a new reel from scratch/);
		assert.match(html, /Create now/);
	});
});
