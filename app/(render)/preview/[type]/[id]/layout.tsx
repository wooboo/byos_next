import { type ReactNode, Suspense } from "react";

export default function PreviewLayout({ children }: { children: ReactNode }) {
	return (
		<>
			<style>{`
				html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: white; }
				body { position: relative; }
				nextjs-portal { display: none; }
			`}</style>
			<Suspense fallback={<span>Rendering preview...</span>}>
				{children}
			</Suspense>
		</>
	);
}
