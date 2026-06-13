type PerforationMarksProps = {
	count: number;
	containerClassName: string;
	markClassName: string;
};

export function PerforationMarks({
	count,
	containerClassName,
	markClassName,
}: PerforationMarksProps) {
	return (
		<div className={containerClassName}>
			{Array.from({ length: count }).map((_, i) => (
				<span key={i} className={markClassName} aria-hidden />
			))}
		</div>
	);
}
