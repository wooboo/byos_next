import { buildPageNumbers } from "@/components/logs/pagination";
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";

type LogsPaginationProps = {
	page: number;
	perPage: number;
	totalLogs: number;
	onPageChange: (page: number) => void;
};

export function LogsPagination({
	page,
	perPage,
	totalLogs,
	onPageChange,
}: LogsPaginationProps) {
	const totalPages = Math.ceil(totalLogs / perPage);
	const showingFrom = (page - 1) * perPage + 1;
	const showingTo = Math.min(page * perPage, totalLogs);
	const pageNumbers = buildPageNumbers(page, totalPages);

	return (
		<div className="flex flex-col items-center justify-between gap-4 md:flex-row">
			<div className="text-sm text-muted-foreground">
				Showing <span className="font-medium">{showingFrom}</span> to{" "}
				<span className="font-medium">{showingTo}</span> of{" "}
				<span className="font-medium">{totalLogs}</span> logs
			</div>

			<Pagination>
				<PaginationContent>
					<PaginationItem>
						<PaginationPrevious
							onClick={() => page > 1 && onPageChange(page - 1)}
							className={
								page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
							}
						/>
					</PaginationItem>

					{pageNumbers.map((pageNum, i) =>
						pageNum === "ellipsis" ? (
							<PaginationItem key={`ellipsis-${i}`}>
								<PaginationEllipsis />
							</PaginationItem>
						) : (
							<PaginationItem key={pageNum}>
								<PaginationLink
									isActive={page === pageNum}
									onClick={() => onPageChange(pageNum)}
									className="cursor-pointer"
								>
									{pageNum}
								</PaginationLink>
							</PaginationItem>
						),
					)}

					<PaginationItem>
						<PaginationNext
							onClick={() => page < totalPages && onPageChange(page + 1)}
							className={
								page >= totalPages
									? "pointer-events-none opacity-50"
									: "cursor-pointer"
							}
						/>
					</PaginationItem>
				</PaginationContent>
			</Pagination>
		</div>
	);
}
