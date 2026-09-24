import React, { useRef, useEffect, useState } from 'react';
import { GrayImage } from '../../engine/image/types';

interface CanvasImageProps {
  image: GrayImage;
  title?: string;
  brushedRange?: [number, number] | null;
  probedPixel?: { x: number; y: number; r: number } | null;
  onProbe?: (pixel: { x: number; y: number; r: number } | null) => void;
  showMagnifier?: boolean;
  lineProfileY?: number | null; // horizontal row index for line profile plot
  onLineProfileChange?: (y: number) => void;
  className?: string;
}

export const CanvasImage: React.FC<CanvasImageProps> = ({
  image,
  title,
  brushedRange,
  probedPixel,
  onProbe,
  showMagnifier = false,
  lineProfileY = null,
  onLineProfileChange,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

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

    // Draw line profile probe if active
    if (lineProfileY !== null && lineProfileY >= 0 && lineProfileY < h) {
      ctx.strokeStyle = '#F0895B';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, lineProfileY + 0.5);
      ctx.lineTo(w, lineProfileY + 0.5);
      ctx.stroke();
    }
  }, [image, brushedRange, lineProfileY]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = image.w / rect.width;
    const scaleY = image.h / rect.height;

    const px = Math.max(0, Math.min(image.w - 1, Math.floor((e.clientX - rect.left) * scaleX)));
    const py = Math.max(0, Math.min(image.h - 1, Math.floor((e.clientY - rect.top) * scaleY)));

    setHoverPos({ x: px, y: py });
    const intensity = image.data[py * image.w + px];
    onProbe?.({ x: px, y: py, r: intensity });

    if (e.buttons === 1 && onLineProfileChange) {
      onLineProfileChange(py);
    }
  };

  const handleMouseLeave = () => {
    setHoverPos(null);
    onProbe?.(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onLineProfileChange) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleY = image.h / rect.height;
    const py = Math.max(0, Math.min(image.h - 1, Math.floor((e.clientY - rect.top) * scaleY)));
    onLineProfileChange(py);
  };

  return (
    <div className={`relative flex flex-col items-center group ${className}`}>
      {title && (
        <div className="text-xs font-semibold text-text-muted mb-1.5 flex items-center justify-between w-full">
          <span>{title}</span>
          <span className="font-mono text-[11px] opacity-75">{image.w}×{image.h}</span>
        </div>
      )}

      <div className="relative rounded-2xl overflow-hidden border border-border-light dark:border-border-dark shadow-sm bg-surface-mutedLight dark:bg-surface-mutedDark">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          className="w-full h-auto max-w-[280px] aspect-square block cursor-crosshair [image-rendering:pixelated]"
        />

        {/* Hover readout badge */}
        {hoverPos && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 backdrop-blur text-white text-[10px] font-mono rounded-lg pointer-events-none shadow-md">
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

      {lineProfileY !== null && (
        <div className="mt-1 text-[10px] font-mono text-text-muted">
          Profile row Y = {lineProfileY} (drag on image to adjust)
        </div>
      )}
    </div>
  );
};
