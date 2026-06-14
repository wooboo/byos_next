import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import { DeviceFrame } from "../../../../components/common/device-frame.tsx";
import { Graph } from "../../../../components/common/graph.tsx";
import { StatusIndicator } from "../../../../components/common/status-indicator.tsx";
import type { CalendarEvent } from "../../../../lib/calendar/ics.ts";
import Album from "./album/album.tsx";
import CryptoPrice from "./bitcoin-price/bitcoin-price.tsx";
import BitmapPatterns from "./bitmap-patterns/bitmap-patterns.tsx";
import CalendarDaily from "./calendar-daily/calendar-daily.tsx";
import CalendarMonthly from "./calendar-monthly/calendar-monthly.tsx";
import CalendarWeekly from "./calendar-weekly/calendar-weekly.tsx";
import SimpleText from "./simple-text/simple-text.tsx";
import Weather from "./weather/weather.tsx";
import Wikipedia from "./wikipedia/wikipedia.tsx";

function render(element: React.ReactElement) {
	return renderToStaticMarkup(element);
}

function calendarEvent(
	summary: string,
	start: Date,
	isAllDay = false,
): CalendarEvent {
	return {
		summary,
		start,
		end: new Date(start.getTime() + 60 * 60 * 1000),
		isAllDay,
	};
}

describe("recipe screen components", () => {
	it("server-renders simple text and album screens", async () => {
		const album = await Album({
			width: 400,
			height: 300,
			params: { imageUrl: "https://example.com/album.png" },
		});
		const html = render(
			<div>
				<SimpleText width={400} height={240} />
				{album}
			</div>,
		);

		assert.match(html, /Hello World/);
		assert.match(html, /https:\/\/example.com\/album.png/);
	});

	it("server-renders bitcoin and weather screens with data-dependent branches", () => {
		const prices = [
			{ timestamp: Date.UTC(2026, 0, 1), price: 100 },
			{ timestamp: Date.UTC(2026, 0, 2), price: 110 },
			{ timestamp: Date.UTC(2026, 0, 3), price: 105 },
		];
		const html = render(
			<div>
				<CryptoPrice
					price="100000"
					change24h="-1.5"
					marketCap="2T"
					volume24h="50B"
					high24h="101000"
					low24h="99000"
					lastUpdated="12:00"
					historicalPrices={prices}
					cryptoImage="https://example.com/btc.png"
					width={800}
					height={480}
				/>
				<Weather
					temperature="21"
					feelsLike="20"
					humidity="60"
					windSpeed="12"
					description="clear sky"
					location="Warsaw"
					lastUpdated="12:00"
					highTemp="24"
					lowTemp="16"
					pressure="1012"
					sunrise="04:30"
					sunset="21:00"
				/>
			</div>,
		);

		assert.match(html, /Bitcoin Price Tracker/);
		assert.match(html, /Last updated: 12:00/);
		assert.match(html, /Warsaw/);
		assert.match(html, /Feels Like/);
	});

	it("server-renders weekly calendar with timed and all-day events", () => {
		const start = new Date(2026, 0, 12, 9, 30);
		const days = Array.from({ length: 7 }, (_, index) => ({
			name: `Day ${index + 1}`,
			date: new Date(2026, 0, 12 + index),
			isToday: index === 1,
			isWeekend: index >= 5,
			events:
				index === 1
					? [
							calendarEvent("Planning", start),
							calendarEvent("Release", new Date(2026, 0, 13), true),
						]
					: [],
		}));

		const html = render(
			<CalendarWeekly days={days} width={800} height={480} />,
		);

		assert.match(html, /Planning/);
		assert.match(html, /Release/);
		assert.match(html, /09:30/);
	});

	it("server-renders daily and monthly calendar layouts", () => {
		const event = calendarEvent(
			"Quarterly planning sync",
			new Date(2026, 0, 13, 9, 30),
		);
		const days = Array.from({ length: 5 }, (_, weekIndex) =>
			Array.from({ length: 7 }, (_, dayIndex) => {
				const day = weekIndex * 7 + dayIndex + 1;
				return {
					day,
					date: new Date(2026, 0, day),
					isToday: day === 13,
					isWeekend: dayIndex >= 5,
					events: day === 13 ? [event] : [],
				};
			}),
		);

		const html = render(
			<div>
				<CalendarDaily
					date={new Date(2026, 0, 13)}
					dayName="wtorek"
					isToday
					events={[
						event,
						calendarEvent("Holiday", new Date(2026, 0, 13), true),
					]}
					width={800}
					height={480}
				/>
				<CalendarDaily
					date={new Date(2026, 0, 14)}
					dayName="środa"
					isToday={false}
					events={[]}
					width={400}
					height={480}
				/>
				<CalendarMonthly
					year={2026}
					month={0}
					monthName="styczeń"
					days={days}
					width={800}
					height={480}
				/>
			</div>,
		);

		assert.match(html, /Quarterly planning/);
		assert.match(html, /cały dzień/);
		assert.match(html, /Brak wydarzeń/);
		assert.match(html, /styczeń 2026/);
	});

	it("server-renders wikipedia and bitmap pattern screens", async () => {
		const wikipedia = await Wikipedia({
			title: "",
			displaytitle: "<span>Test Article</span>",
			extract: `${"Long article sentence. ".repeat(60)}Final sentence.`,
			description: "A long encyclopedic description".repeat(8),
			fullurl: "https://en.wikipedia.org/wiki/Test",
			thumbnail: {
				source: "https://example.com/thumb.webp",
				width: 320,
				height: 200,
			},
			content_urls: {
				desktop: { page: "https://example.com/fallback" },
			},
			width: 800,
			height: 480,
		});
		const half = await Wikipedia({
			title: "Half",
			extract: "Short extract",
			description: "Short description",
			thumbnail: {
				source: "http://invalid.example/thumb.webp",
				width: 0,
				height: 0,
			},
			width: 400,
			height: 480,
		});
		const html = render(
			<div>
				{wikipedia}
				{half}
				<BitmapPatterns width={800} height={480} />
			</div>,
		);

		assert.match(html, /Test Article/);
		assert.match(html, /https:\/\/example.com\/thumb.webp/);
		assert.match(html, /Wikipedia • Random Article/);
		assert.match(html, /Half/);
		assert.match(html, /22 shades of gray/);
		assert.match(html, /0: white, 1000: black/);
	});
});

describe("common display components", () => {
	it("server-renders frame, graph, and status indicator variants", () => {
		const html = render(
			<div>
				<DeviceFrame size="lg" screenWidth={800} screenHeight={480}>
					<div>Screen</div>
				</DeviceFrame>
				<Graph
					data={[
						{ x: 1, y: 10 },
						{ x: 2, y: 15 },
						{ x: 3, y: 12 },
					]}
					curveType="linear"
					showGrid={false}
				/>
				<StatusIndicator status="online" />
				<StatusIndicator status="offline" />
			</div>,
		);

		assert.match(html, /Screen/);
		assert.match(html, /Line graph/);
		assert.match(html, /bg-green-500/);
		assert.match(html, /bg-red-500/);
	});
});
