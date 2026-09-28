import React, { useRef, useEffect, useState } from 'react';
import { GrayImage } from '../../engine/image/types';

export interface CanvasImageProps {
  image: GrayImage;
  title?: string;
  brushedRange?: [number, number] | null;
  probedPixel?: { x: number; y: number; r?: number } | null;
  /** Explicit probe point for real-time (px, py) visualization */
  probePoint?: { x: number; y: number } | null;
  /** Kernel / window size (e.g. 3, 5, 7) to draw a neighbourhood boundary around the red dot */
  kernelSize?: number;
  /** Callback when user clicks or drags on the canvas to move probe coordinates */
  onProbePointChange?: (point: { x: number; y: number }) => void;
  onProbe?: (pixel: { x: number; y: number; r: number } | null) => void;
  showMagnifier?: boolean;
  lineProfileY?: number | null; // horizontal row index for line profile plot
  lineProfileX?: number | null; // vertical column index
  onLineProfileChange?: (y: number) => void;
  className?: string;
}

export const CanvasImage: React.FC<CanvasImageProps> = ({
  image,
  title,
  brushedRange,
  probedPixel,
  probePoint,
  kernelSize,
  onProbePointChange,
  onProbe,
  showMagnifier = false,
  lineProfileY = null,
  lineProfileX = null,
  onLineProfileChange,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Active probe location prioritizing probePoint prop, fallback to probedPixel
  const activeProbe = probePoint ?? (probedPixel ? { x: probedPixel.x, y: probedPixel.y } : null);

  // Render image and highlight mask
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h, data } = image;
    canvas.width = w;
    canvas.height = h;

    const imgData = ctx.createImageData(w, h);
    const rgba = imgData.data;

    const hasBrush = brushedRange !== null && brushedRange !== undefined;
    const [minR, maxR] = hasBrush ? brushedRange! : [-1, -1];

    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      const idx = i * 4;

      if (hasBrush && val >= minR && val <= maxR) {
        // Highlight in emerald green
        rgba[idx] = 16;
        rgba[idx + 1] = 185;
        rgba[idx + 2] = 129;
        rgba[idx + 3] = 255;
      } else {
        rgba[idx] = val;
        rgba[idx + 1] = val;
        rgba[idx + 2] = val;
        rgba[idx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw horizontal line profile probe if active
    if (lineProfileY !== null && lineProfileY >= 0 && lineProfileY < h) {
      ctx.strokeStyle = '#F0895B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, lineProfileY + 0.5);
      ctx.lineTo(w, lineProfileY + 0.5);
      ctx.stroke();
    }

    // Draw vertical line profile probe if active
    if (lineProfileX !== null && lineProfileX >= 0 && lineProfileX < w) {
      ctx.strokeStyle = '#F0895B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lineProfileX + 0.5, 0);
      ctx.lineTo(lineProfileX + 0.5, h);
      ctx.stroke();
    }
  }, [image, brushedRange, lineProfileY, lineProfileX]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = image.w / rect.width;
    const scaleY = image.h / rect.height;

    const px = Math.max(0, Math.min(image.w - 1, Math.floor((e.clientX - rect.left) * scaleX)));
    const py = Math.max(0, Math.min(image.h - 1, Math.floor((e.clientY - rect.top) * scaleY)));
    return { px, py };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;
    const { px, py } = coords;

    setHoverPos({ x: px, y: py });
    const intensity = image.data[py * image.w + px];
    onProbe?.({ x: px, y: py, r: intensity });

    if (e.buttons === 1) {
      if (onProbePointChange) {
        onProbePointChange({ x: px, y: py });
      }
      if (onLineProfileChange) {
        onLineProfileChange(py);
      }
    }
  };

  const handleMouseLeave = () => {
    setHoverPos(null);
    onProbe?.(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords) return;
    const { px, py } = coords;

    if (onProbePointChange) {
      onProbePointChange({ x: px, y: py });
    }
    if (onLineProfileChange) {
      onLineProfileChange(py);
    }
  };

  // Clamped probe coords and intensity value
  const probeInfo = React.useMemo(() => {
    if (!activeProbe) return null;
    const px = Math.max(0, Math.min(image.w - 1, Math.round(activeProbe.x)));
    const py = Math.max(0, Math.min(image.h - 1, Math.round(activeProbe.y)));
    const intensity = image.data[py * image.w + px];
    return { x: px, y: py, intensity };
  }, [activeProbe, image]);

  return (
    <div className={`relative flex flex-col items-center group ${className}`}>
      {title && (
        <div className="text-xs font-semibold text-text-muted mb-1.5 flex items-center justify-between w-full">
          <span>{title}</span>
          <span className="font-mono text-[11px] opacity-75">{image.w}×{image.h}</span>
        </div>
      )}

      <div className="relative rounded-2xl overflow-hidden border border-border-light dark:border-border-dark shadow-sm bg-surface-mutedLight dark:bg-surface-mutedDark select-none">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          className="w-full h-auto max-w-[280px] aspect-square block cursor-crosshair [image-rendering:pixelated]"
        />

        {/* ================= Real-time Moving Red Probe Dot ================= */}
        {probeInfo && (
          <div
            className="absolute pointer-events-none transition-[left,top] duration-100 ease-out z-20"
            style={{
              left: `${((probeInfo.x + 0.5) / image.w) * 100}%`,
              top: `${((probeInfo.y + 0.5) / image.h) * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Optional neighbourhood window boundary if kernelSize is given */}
            {kernelSize && kernelSize > 1 && (
              <div
                className="absolute border border-dashed border-red-500/90 bg-red-500/15 pointer-events-none rounded-[3px] -translate-x-1/2 -translate-y-1/2"
                style={{
                  width: `${(kernelSize / image.w) * 100 * (280 / Math.max(1, image.w))}px`,
                  height: `${(kernelSize / image.h) * 100 * (280 / Math.max(1, image.h))}px`,
                  left: '50%',
                  top: '50%',
                }}
                title={`${kernelSize}×${kernelSize} neighbourhood window`}
              />
            )}

            {/* Subtle Crosshair Guide Lines */}
            <div className="absolute w-6 h-[1.5px] bg-red-500/60 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="absolute h-6 w-[1.5px] bg-red-500/60 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

            {/* Outer animated ping wave */}
            <span className="absolute -inset-1.5 rounded-full bg-red-500 animate-ping opacity-75" />

            {/* Glowing Red Dot */}
            <div
              className="relative w-3.5 h-3.5 rounded-full bg-red-600 border-2 border-white dark:border-black shadow-[0_0_12px_rgba(239,68,68,0.9)] flex items-center justify-center pointer-events-none"
              title={`Probe Point: (${probeInfo.x}, ${probeInfo.y})`}
            >
              <div className="w-1 h-1 rounded-full bg-white shadow-xs" />
            </div>

            {/* Floating Coordinate Pill Badge */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-md bg-black/90 backdrop-blur text-[9px] font-mono text-white whitespace-nowrap shadow-lg pointer-events-none flex items-center gap-1 border border-white/20 z-30">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-pulse" />
              <span className="text-red-400 font-bold">({probeInfo.x}, {probeInfo.y})</span>
              <span className="text-zinc-300 border-l border-white/20 pl-1">r={probeInfo.intensity}</span>
            </div>
          </div>
        )}

        {/* Hover readout badge (shown when mouse is actively over another pixel) */}
        {hoverPos && (!probeInfo || hoverPos.x !== probeInfo.x || hoverPos.y !== probeInfo.y) && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 backdrop-blur text-white text-[10px] font-mono rounded-lg pointer-events-none shadow-md z-10">
            <span>({hoverPos.x}, {hoverPos.y})</span>
            <span className="mx-1 text-accent font-bold">r = {image.data[hoverPos.y * image.w + hoverPos.x]}</span>
          </div>
        )}

        {/* Magnifier lens */}
        {showMagnifier && hoverPos && (
          <div
            className="absolute w-20 h-20 rounded-full border-2 border-accent shadow-xl overflow-hidden pointer-events-none bg-surface-light dark:bg-surface-dark [image-rendering:pixelated]"
            style={{
              left: `${Math.max(10, Math.min(image.w - 90, (hoverPos.x / image.w) * 100))}%`,
              top: `${Math.max(10, Math.min(image.h - 90, (hoverPos.y / image.h) * 100))}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="w-full h-full flex items-center justify-center font-mono font-bold text-xs bg-accent/10">
              r: {image.data[hoverPos.y * image.w + hoverPos.x]}
            </div>
          </div>
        )}
      </div>

      {/* Footer labels */}
      <div className="mt-1.5 flex flex-col items-center gap-0.5 text-[10px] font-mono text-text-muted">
        {probeInfo && (
          <div className="flex items-center gap-1.5 text-text-light dark:text-text-dark font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse" />
            <span>Probe: ({probeInfo.x}, {probeInfo.y}) · Intensity = {probeInfo.intensity}</span>
          </div>
        )}
        {lineProfileY !== null && (
          <div className="text-text-muted">
            Profile row Y = {lineProfileY} (drag on image or use slider)
          </div>
        )}
      </div>
    </div>
  );
};
