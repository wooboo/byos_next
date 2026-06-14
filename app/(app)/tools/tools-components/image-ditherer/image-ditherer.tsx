"use client";

import {
	Copy,
	Download,
	ImageIcon,
	Sliders,
	Upload,
	ZoomIn,
	ZoomOut,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { applyDithering as processDithering } from "@/utils/image-processing";
import {
	applyDitheredValuesToImageData,
	buildBmpBuffer,
	extractGrayscaleChannel,
	preprocessImageData,
	resolveBayerPatternSize,
	resolveDitheringMethod,
} from "./image-ditherer-helpers";

export default function ImageDitherer() {
	const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(
		null,
	);
	const [ditheringMethod, setDitheringMethod] = useState("floydSteinberg");
	const [brightness, setBrightness] = useState([0]);
	const [contrast, setContrast] = useState([0]);
	const [threshold, setThreshold] = useState([128]);
	const [patternSize, setPatternSize] = useState([4]);
	const [inverted, setInverted] = useState(false);
	const [zoom, setZoom] = useState(1);
	const [showControls, setShowControls] = useState(true);
	const [copyStatus, setCopyStatus] = useState("");
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const img = new Image();
			img.crossOrigin = "anonymous";
			img.onload = () => setOriginalImage(img);
			img.onerror = (err) => console.error("Image loading error:", err);
			img.src = event.target?.result as string;
		};
		reader.onerror = (err) => console.error("FileReader error:", err);
		reader.readAsDataURL(file);
		e.target.value = "";
	};

	const applyDithering = useCallback(() => {
		if (!originalImage || !canvasRef.current) return;

		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		// Calculate dimensions while maintaining aspect ratio
		const width = originalImage.width;
		const height = originalImage.height;

		// Set canvas to image dimensions (we'll handle display scaling with CSS)
		canvas.width = width;
		canvas.height = height;

		// Create a temporary canvas for pre-processing
		const tempCanvas = document.createElement("canvas");
		tempCanvas.width = width;
		tempCanvas.height = height;
		const tempCtx = tempCanvas.getContext("2d");
		if (!tempCtx) return;

		// Draw original image with brightness and contrast adjustments
		tempCtx.clearRect(0, 0, width, height);
		tempCtx.drawImage(originalImage, 0, 0, width, height);

		const imageData = tempCtx.getImageData(0, 0, width, height);
		imageData.data.set(
			preprocessImageData(imageData.data, brightness[0], contrast[0]),
		);
		tempCtx.putImageData(imageData, 0, 0);

		// Get the pre-processed image data for dithering
		const processedImageData = tempCtx.getImageData(0, 0, width, height);
		const grayscaleData = extractGrayscaleChannel(processedImageData.data);

		const bayerSize = resolveBayerPatternSize(patternSize[0]);
		const method = resolveDitheringMethod(ditheringMethod);
		const dithered = processDithering(method, grayscaleData, {
			width,
			height,
			threshold: threshold[0],
			bayerPatternSize: bayerSize,
		});

		processedImageData.data.set(
			applyDitheredValuesToImageData(
				processedImageData.data,
				dithered,
				inverted,
			),
		);
		ctx.putImageData(processedImageData, 0, 0);
	}, [
		originalImage,
		ditheringMethod,
		brightness,
		contrast,
		threshold,
		patternSize,
		inverted,
	]);

	// Function to convert canvas to BMP and download
	const downloadAsBMP = () => {
		if (!canvasRef.current) return;

		const canvas = canvasRef.current;
		const width = canvas.width;
		const height = canvas.height;
		const imageData = canvas
			.getContext("2d")
			?.getImageData(0, 0, width, height);

		if (!imageData) return;

		const buffer = buildBmpBuffer(imageData.data, width, height);

		// Create blob and download
		const blob = new Blob([buffer], { type: "image/bmp" });
		const link = document.createElement("a");
		link.href = URL.createObjectURL(blob);
		link.download = "dithered-image.bmp";
		link.click();
	};

	// Function to copy canvas as base64
	const copyAsBase64 = async () => {
		if (!canvasRef.current) return;

		try {
			const base64Data = canvasRef.current.toDataURL("image/png");
			await navigator.clipboard.writeText(base64Data);
			setCopyStatus("Copied!");
			setTimeout(() => setCopyStatus(""), 2000);
		} catch (err) {
			console.error("Error when copying base64:", err);
			setCopyStatus("Failed to copy");
			setTimeout(() => setCopyStatus(""), 2000);
		}
	};

	const zoomIn = () => {
		setZoom((prev) => Math.min(prev + 0.25, 5));
	};

	const zoomOut = () => {
		setZoom((prev) => Math.max(prev - 0.25, 0.25));
	};

	const handleFileInputClick = () => {
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
			fileInputRef.current.click();
		}
	};

	useEffect(() => {
		if (originalImage) applyDithering();
	}, [originalImage, applyDithering]);

	return (
		<div ref={containerRef} className="w-full">
			<input
				ref={fileInputRef}
				type="file"
				accept="image/*"
				onChange={handleImageUpload}
				className="hidden"
			/>

			{!originalImage ? (
				<button
					type="button"
					onClick={handleFileInputClick}
					className={cn(
						"flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-muted/20 px-6 py-16 text-center",
						"transition-colors hover:border-primary hover:bg-primary/5",
					)}
				>
					<div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
						<ImageIcon className="h-7 w-7" />
					</div>
					<div>
						<div className="text-base font-semibold">No image yet</div>
						<p className="mt-1 text-sm text-muted-foreground">
							Drop an image or browse to dither it 1-bit.
						</p>
					</div>
					<div className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
						<Upload className="h-4 w-4" />
						Upload an image
					</div>
				</button>
			) : (
				<div className="overflow-hidden rounded-2xl border bg-card">
					<div className="flex flex-col md:flex-row">
						<button
							type="button"
							className="relative w-full cursor-pointer overflow-auto border-0 bg-muted/20 p-0 md:h-[600px] md:w-3/4"
							onClick={() => setShowControls(!showControls)}
						>
							<div className="flex min-h-[400px] items-center justify-center md:h-full">
								<canvas
									ref={canvasRef}
									style={{
										transform: `scale(${zoom})`,
										transition: "transform 0.2s ease-out",
										imageRendering: "pixelated",
									}}
									className="max-w-none"
								/>
							</div>
						</button>

						{/* Controls panel */}
						<div className="w-full border-t md:w-1/4 md:border-l md:border-t-0">
							<div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
								<div className="flex items-center gap-2">
									<Sliders className="h-3.5 w-3.5 text-muted-foreground" />
									<h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
										Controls
									</h3>
								</div>
								<div className="flex gap-1">
									<Button
										variant="ghost"
										size="icon"
										onClick={zoomOut}
										className="h-7 w-7"
									>
										<ZoomOut className="h-3.5 w-3.5" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										onClick={zoomIn}
										className="h-7 w-7"
									>
										<ZoomIn className="h-3.5 w-3.5" />
									</Button>
								</div>
							</div>
							<div className="space-y-4 p-4">
								<div className="space-y-2">
									<label
										htmlFor="dithering-method"
										className="text-xs font-medium"
									>
										Dithering Method
									</label>
									<Select
										value={ditheringMethod}
										onValueChange={setDitheringMethod}
									>
										<SelectTrigger
											id="dithering-method"
											className="h-8 text-sm"
										>
											<SelectValue placeholder="Select dithering method" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="threshold">Threshold</SelectItem>
											<SelectItem value="floydSteinberg">
												Floyd-Steinberg
											</SelectItem>
											<SelectItem value="atkinson">Atkinson</SelectItem>
											<SelectItem value="bayer">Ordered (Bayer)</SelectItem>
											<SelectItem value="random">Random</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{ditheringMethod === "threshold" && (
									<div className="space-y-1">
										<label
											htmlFor="threshold-slider"
											className="text-xs font-medium"
										>
											Threshold ({threshold[0]})
										</label>
										<Slider
											id="threshold-slider"
											value={threshold}
											min={0}
											max={255}
											step={1}
											onValueChange={setThreshold}
											className="h-4"
										/>
									</div>
								)}

								{ditheringMethod === "bayer" && (
									<div className="space-y-1">
										<label
											htmlFor="pattern-size-slider"
											className="text-xs font-medium"
										>
											Pattern Size ({patternSize[0]}x{patternSize[0]})
										</label>
										<Slider
											id="pattern-size-slider"
											value={patternSize}
											min={2}
											max={8}
											step={2}
											onValueChange={setPatternSize}
											className="h-4"
										/>
									</div>
								)}

								<div className="space-y-1">
									<label
										htmlFor="brightness-slider"
										className="text-xs font-medium"
									>
										Brightness ({brightness[0]})
									</label>
									<Slider
										id="brightness-slider"
										value={brightness}
										min={-200}
										max={200}
										step={1}
										onValueChange={setBrightness}
										className="h-4"
									/>
								</div>

								<div className="space-y-1">
									<label
										htmlFor="contrast-slider"
										className="text-xs font-medium"
									>
										Contrast ({contrast[0]})
									</label>
									<Slider
										id="contrast-slider"
										value={contrast}
										min={-100}
										max={100}
										step={1}
										onValueChange={setContrast}
										className="h-4"
									/>
								</div>

								<div className="flex items-center space-x-2">
									<input
										type="checkbox"
										id="invert"
										checked={inverted}
										onChange={(e) => setInverted(e.target.checked)}
										className="rounded"
									/>
									<label htmlFor="invert" className="text-xs font-medium">
										Invert Colors
									</label>
								</div>

								<div className="grid grid-cols-1 gap-2 pt-2">
									<Button
										size="sm"
										variant="secondary"
										onClick={handleFileInputClick}
									>
										<Upload className="h-3 w-3 mr-1" />
										Select New Image
									</Button>

									<Button size="sm" variant="secondary" onClick={copyAsBase64}>
										<Copy className="h-3 w-3 mr-1" />
										Copy as Base64
										{copyStatus && (
											<span className="ml-1 text-xs">{copyStatus}</span>
										)}
									</Button>

									<Button size="sm" variant="default" onClick={downloadAsBMP}>
										<Download className="h-3 w-3 mr-1" />
										Download as BMP
									</Button>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
