export type PageNumber = number | "ellipsis";

function range(start: number, end: number): number[] {
	return Array.from(
		{ length: Math.max(0, end - start + 1) },
		(_, i) => start + i,
	);
}

export function buildPageNumbers(
	page: number,
	totalPages: number,
): PageNumber[] {
	if (totalPages <= 5) return range(1, totalPages);
	if (page <= 3) return [...range(1, 5), "ellipsis", totalPages];
	if (page >= totalPages - 2) {
		return [1, "ellipsis", ...range(totalPages - 4, totalPages)];
	}

	return [1, "ellipsis", ...range(page - 1, page + 1), "ellipsis", totalPages];
}
