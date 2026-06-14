import assert from "node:assert/strict";
import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import {
	buildLogsQueryString,
	clearLogsFilters,
	EmptyLogsTableRow,
	LogsLevelTabs,
	LogsTableHeader,
	LogsTableSkeleton,
	scrollLogsIntoView,
	shouldShowGroupedLogValue,
} from "./log-viewer-helpers";

describe("log-viewer-helpers", () => {
	it("groups rows by time threshold and value changes", () => {
		const current = { created_at: "2026-06-13T10:00:08.000Z", level: "info" };
		const previous = { created_at: "2026-06-13T10:00:00.000Z", level: "info" };

		assert.equal(
			shouldShowGroupedLogValue({
				index: 0,
				current,
				previous: null,
				thresholdSeconds: 10,
				getCreatedAt: (log) => log.created_at,
			}),
			true,
		);
		assert.equal(
			shouldShowGroupedLogValue({
				index: 1,
				current,
				previous,
				thresholdSeconds: 10,
				getCreatedAt: (log) => log.created_at,
			}),
			false,
		);
		assert.equal(
			shouldShowGroupedLogValue({
				index: 1,
				current: { ...current, level: "error" },
				previous,
				thresholdSeconds: 10,
				getCreatedAt: (log) => log.created_at,
				getValue: (log) => log.level,
			}),
			true,
		);
	});

	it("renders skeleton and empty table rows with the expected content", () => {
		const skeletonHtml = renderToStaticMarkup(
			<tbody>
				<LogsTableSkeleton cellWidths={["w-24", "w-full"]} />
			</tbody>,
		);
		const emptyHtml = renderToStaticMarkup(
			<tbody>
				<EmptyLogsTableRow colSpan={5} />
			</tbody>,
		);

		assert.equal(
			(skeletonHtml.match(/data-slot="table-row"/g) ?? []).length,
			5,
		);
		assert.match(skeletonHtml, /w-24/);
		assert.match(skeletonHtml, /w-full/);
		assert.match(emptyHtml, /colSpan="5"/);
		assert.match(emptyHtml, /No logs found matching your criteria/);
	});

	it("builds query strings, clears filters, and scrolls after loading", () => {
		assert.equal(
			buildLogsQueryString({
				searchParams: new URLSearchParams("page=3&activeTab=warning&source=db"),
				params: {
					page: 2,
					search: "disk",
					source: null,
					activeTab: "ignored",
				},
				paramPrefix: "system_",
				preserveActiveTab: true,
			}),
			"page=3&activeTab=warning&source=db&system_page=2&system_search=disk",
		);

		const pushed: Array<{ href: string; options?: { scroll: boolean } }> = [];
		const searchInputRef = createRef<HTMLInputElement>();
		searchInputRef.current = { value: "disk" } as HTMLInputElement;

		clearLogsFilters({
			router: {
				push: (href, options) => pushed.push({ href, options }),
			},
			pathname: "/system-logs",
			searchInputRef,
		});

		assert.deepEqual(pushed, [
			{ href: "/system-logs", options: { scroll: false } },
		]);
		assert.equal(searchInputRef.current?.value, "");

		let scrollCalls = 0;
		const scrollRef = createRef<HTMLDivElement>();
		scrollRef.current = {
			scrollIntoView: () => {
				scrollCalls += 1;
			},
		} as HTMLDivElement;

		assert.equal(scrollLogsIntoView(scrollRef, false), true);
		assert.equal(scrollLogsIntoView(scrollRef, true), false);
		assert.equal(scrollCalls, 1);
	});

	it("filters available level tabs and hides debug unless requested", () => {
		const html = renderToStaticMarkup(
			<LogsLevelTabs
				value="error"
				onValueChange={() => {}}
				listClassName="grid-cols-3"
				availableLevels={["error", "info"]}
			/>,
		);

		assert.match(html, />All</);
		assert.match(html, />Error</);
		assert.match(html, />Info</);
		assert.doesNotMatch(html, />Warning</);
		assert.doesNotMatch(html, />Debug</);
	});

	it("renders a table header row for each supplied heading", () => {
		const html = renderToStaticMarkup(
			<table>
				<LogsTableHeader headers={["Time", "Level", "Source"]} />
			</table>,
		);

		assert.match(html, />Time</);
		assert.match(html, />Level</);
		assert.match(html, />Source</);
	});
});
