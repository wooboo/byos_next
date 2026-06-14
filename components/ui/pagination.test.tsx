import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it } from "vitest";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "./pagination";

describe("Pagination", () => {
	it("renders slots and active link state", () => {
		const html = renderToStaticMarkup(
			<Pagination className="pager">
				<PaginationContent>
					<PaginationItem>
						<PaginationPrevious href="?page=1" />
					</PaginationItem>
					<PaginationItem>
						<PaginationLink href="?page=2" isActive>
							2
						</PaginationLink>
					</PaginationItem>
					<PaginationItem>
						<PaginationEllipsis />
					</PaginationItem>
					<PaginationItem>
						<PaginationNext href="?page=3" />
					</PaginationItem>
				</PaginationContent>
			</Pagination>,
		);

		assert.match(html, /aria-label="pagination"/);
		assert.match(html, /data-slot="pagination"/);
		assert.match(html, /data-slot="pagination-content"/);
		assert.match(html, /data-slot="pagination-item"/);
		assert.match(html, /data-slot="pagination-link"/);
		assert.match(html, /aria-current="page"/);
		assert.match(html, /data-slot="pagination-ellipsis"/);
		assert.match(html, /Go to previous page/);
		assert.match(html, /Go to next page/);
		assert.match(html, /class="[^"]*pager/);
	});
});
