import assert from "node:assert/strict";
import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import { LogsPagination } from "./logs-pagination";

type TestElement = React.ReactElement<
	Record<string, unknown>,
	React.ElementType
>;
type ClickableProps = {
	onClick?: () => void;
	children?: React.ReactNode;
};

function elementTypeName(element: TestElement) {
	return typeof element.type === "function" ? element.type.name : "";
}

function elementProps(element: TestElement) {
	return element.props;
}

function asClickableElement(
	element: TestElement | undefined,
): React.ReactElement<ClickableProps, React.ElementType> | undefined {
	return element as
		| React.ReactElement<ClickableProps, React.ElementType>
		| undefined;
}

function collectElements(
	node: React.ReactNode,
	predicate: (element: TestElement) => boolean,
	acc: TestElement[] = [],
) {
	if (Array.isArray(node)) {
		for (const child of node) {
			collectElements(child, predicate, acc);
		}
		return acc;
	}

	if (!isValidElement(node)) {
		return acc;
	}

	const element = node as TestElement;

	if (predicate(element)) {
		acc.push(element);
	}

	collectElements(
		elementProps(element).children as React.ReactNode,
		predicate,
		acc,
	);
	return acc;
}

describe("LogsPagination", () => {
	it("renders the current range and active page", () => {
		const html = renderToStaticMarkup(
			<LogsPagination
				page={3}
				perPage={10}
				totalLogs={95}
				onPageChange={() => {}}
			/>,
		);

		assert.match(
			html,
			/Showing <span class="font-medium">21<\/span> to <span class="font-medium">30<\/span> of <span class="font-medium">95<\/span> logs/,
		);
		assert.match(html, /aria-current="page"[^>]*>3</);
		assert.match(html, /Go to previous page/);
		assert.match(html, /Go to next page/);
	});

	it("disables previous and next links at the edges", () => {
		const html = renderToStaticMarkup(
			<LogsPagination
				page={1}
				perPage={10}
				totalLogs={5}
				onPageChange={() => {}}
			/>,
		);

		assert.match(
			html,
			/Showing <span class="font-medium">1<\/span> to <span class="font-medium">5<\/span> of <span class="font-medium">5<\/span> logs/,
		);
		assert.equal(
			(html.match(/pointer-events-none opacity-50/g) ?? []).length,
			2,
		);
	});

	it("invokes previous, numbered, and next page handlers only when they are enabled", () => {
		const pages: number[] = [];
		const tree = LogsPagination({
			page: 3,
			perPage: 10,
			totalLogs: 95,
			onPageChange: (page) => pages.push(page),
		});

		const paginationControls = collectElements(tree, (element) => {
			return (
				typeof element.type === "function" &&
				["PaginationPrevious", "PaginationLink", "PaginationNext"].includes(
					elementTypeName(element),
				)
			);
		});

		const previous = asClickableElement(
			paginationControls.find(
				(element) => elementTypeName(element) === "PaginationPrevious",
			),
		);
		const pageFive = asClickableElement(
			paginationControls.find(
				(element) =>
					elementTypeName(element) === "PaginationLink" &&
					elementProps(element).children === 5,
			),
		);
		const next = asClickableElement(
			paginationControls.find(
				(element) => elementTypeName(element) === "PaginationNext",
			),
		);

		previous?.props.onClick?.();
		pageFive?.props.onClick?.();
		next?.props.onClick?.();

		assert.deepEqual(pages, [2, 5, 4]);

		const blockedPages: number[] = [];
		const edgeTree = LogsPagination({
			page: 1,
			perPage: 10,
			totalLogs: 5,
			onPageChange: (page) => blockedPages.push(page),
		});
		const edgeControls = collectElements(edgeTree, (element) => {
			return (
				typeof element.type === "function" &&
				["PaginationPrevious", "PaginationNext"].includes(
					elementTypeName(element),
				)
			);
		});

		for (const control of edgeControls) {
			asClickableElement(control)?.props.onClick?.();
		}

		assert.deepEqual(blockedPages, []);
	});
});
