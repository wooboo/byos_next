import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PerforationMarks } from "./perforation-marks";

describe("PerforationMarks", () => {
	it("renders the requested number of decorative marks", () => {
		const html = renderToStaticMarkup(
			<PerforationMarks
				count={4}
				containerClassName="filmstrip"
				markClassName="hole"
			/>,
		);

		expect(html).toContain('class="filmstrip"');
		expect(html.match(/class="hole"/g)).toHaveLength(4);
		expect(html.match(/aria-hidden/g)).toHaveLength(4);
	});
});
