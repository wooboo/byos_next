import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Graph } from "./graph";

function extractSvgMarkup(html: string) {
	const encodedSvg = html.match(/data:image\/svg\+xml;utf8,([^"]+)/)?.[1];
	assert.ok(encodedSvg, "expected encoded SVG data URI");
	return decodeURIComponent(encodedSvg);
}

function extractPathData(svg: string) {
	const pathData = svg.match(/d="([^"]+)"/)?.[1];
	assert.ok(pathData, "expected SVG path data");
	return pathData;
}

describe("Graph", () => {
	it("renders numeric data without grid lines and applies custom axis formatting", () => {
		const html = renderToStaticMarkup(
			<Graph
				data={[
					{ x: 0, y: 10 },
					{ x: 5, y: 40 },
					{ x: 10, y: 25 },
				]}
				width={320}
				height={180}
				showGrid={false}
				curveType="linear"
				lineColor="#00aa88"
				lineWidth={5}
				xTicks={3}
				yTicks={4}
				xAxisFormat={(value) => `x:${value}`}
				yAxisFormat={(value) => `y:${value}`}
			/>,
		);

		const svg = extractSvgMarkup(html);

		expect(html).toContain('alt="Line graph"');
		expect(html).toContain(">x:0<");
		expect(html).toContain(">x:5<");
		expect(html).toContain(">x:10<");
		expect(html).toContain(">y:10<");
		expect(svg).toContain('stroke="#00aa88"');
		expect(svg).toContain('stroke-width="5"');
		expect(svg).toContain("<path");
		expect(svg).not.toContain("<line");
	});

	it("renders time data with grid lines, default date labels, and fallback curve handling", () => {
		const html = renderToStaticMarkup(
			<Graph
				data={[
					{ x: new Date("2026-03-05T08:00:00.000Z"), y: 15 },
					{ x: new Date("2026-03-05T09:00:00.000Z"), y: 18 },
					{ x: new Date("2026-03-05T10:00:00.000Z"), y: 12 },
				]}
				width={360}
				height={220}
				isTimeData
				xTicks={3}
				yTicks={3}
				gridStyle={{
					opacity: 0.4,
					dashArray: "2,2",
					color: "#334455",
				}}
				curveType={"unknown" as "natural"}
			/>,
		);

		const svg = extractSvgMarkup(html);

		expect(svg).toContain("<line");
		expect(svg).toContain('stroke="#334455"');
		expect(svg).toContain('stroke-opacity="0.4"');
		expect(svg).toContain('stroke-dasharray="2,2"');
		expect(svg).toContain('viewBox="0 0 280 170"');
		expect(html).toMatch(/>\d{2}:\d{2}\s(?:AM|PM)</);
		expect(html).toContain(
			'style="display:flex;flex-direction:row;width:360px;height:220px;position:relative"',
		);
	});

	it("renders natural, monotone, and step curve variants with distinct path output", () => {
		const data = [
			{ x: 0, y: 10 },
			{ x: 5, y: 40 },
			{ x: 10, y: 25 },
			{ x: 15, y: 55 },
		] as const;

		const naturalPath = extractPathData(
			extractSvgMarkup(
				renderToStaticMarkup(
					<Graph data={[...data]} showGrid={false} curveType="natural" />,
				),
			),
		);
		const monotonePath = extractPathData(
			extractSvgMarkup(
				renderToStaticMarkup(
					<Graph data={[...data]} showGrid={false} curveType="monotone" />,
				),
			),
		);
		const stepPath = extractPathData(
			extractSvgMarkup(
				renderToStaticMarkup(
					<Graph data={[...data]} showGrid={false} curveType="step" />,
				),
			),
		);

		expect(naturalPath).toContain("C");
		expect(monotonePath).toContain("C");
		expect(stepPath).not.toContain("C");
		expect(stepPath.match(/L/g)?.length ?? 0).toBeGreaterThan(4);
		expect(naturalPath).not.toBe(monotonePath);
		expect(monotonePath).not.toBe(stepPath);
		expect(naturalPath).not.toBe(stepPath);
	});
});
