import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CreateActionTileProps = {
	onClick?: () => void;
	icon: ReactNode;
	title: string;
	description: string;
	actionLabel?: ReactNode;
	className?: string;
	iconClassName?: string;
};

export function CreateActionTile({
	onClick,
	icon,
	title,
	description,
	actionLabel,
	className,
	iconClassName = "h-14 w-14",
}: CreateActionTileProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-muted/20 text-center",
				"transition-colors hover:border-primary hover:bg-primary/5",
				className,
			)}
		>
			<div
				className={cn(
					"flex items-center justify-center rounded-full bg-primary/10 text-primary",
					iconClassName,
				)}
			>
				{icon}
			</div>
			<div>
				<div className="font-semibold">{title}</div>
				<p className="mt-1 text-muted-foreground">{description}</p>
			</div>
			{actionLabel ? (
				<div className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
					{actionLabel}
				</div>
			) : null}
		</button>
	);
}
