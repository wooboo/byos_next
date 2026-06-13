type FormatDurationOptions = {
	suffix?: string;
	suffixZero?: boolean;
};

export function formatPlaylistDuration(
	seconds: number,
	{ suffix, suffixZero = false }: FormatDurationOptions = {},
): string {
	const suffixText = suffix ? ` ${suffix}` : "";
	if (seconds <= 0) return `0s${suffixZero ? suffixText : ""}`;

	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;

	if (minutes === 0) return `${remainingSeconds}s${suffixText}`;
	if (remainingSeconds === 0) return `${minutes}m${suffixText}`;
	return `${minutes}m ${remainingSeconds}s${suffixText}`;
}
