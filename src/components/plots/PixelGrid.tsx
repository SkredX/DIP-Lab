import React from 'react';

interface PixelGridProps {
  matrix: number[][]; // N x N 2D array of intensity values
  showNumbers?: boolean;
  heatmap?: boolean;
  onCellChange?: (row: number, col: number, newVal: number) => void;
  className?: string;
}

export const PixelGrid: React.FC<PixelGridProps> = ({
  matrix,
  showNumbers = true,
  heatmap = false,
  onCellChange,
  className = '',
}) => {
  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;

  const handleCellClick = (r: number, c: number) => {
    if (!onCellChange) return;
    const current = matrix[r][c];
    const input = prompt(`Enter new pixel intensity (0–255) for [${r}, ${c}]:`, current.toString());
    if (input !== null) {
      const val = parseInt(input, 10);
      if (!isNaN(val)) {
        onCellChange(r, c, Math.max(0, Math.min(255, val)));
      }
    }
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <div
        className="grid gap-1 p-2 rounded-2xl bg-surface-mutedLight dark:bg-surface-mutedDark border border-border-light dark:border-border-dark shadow-sm overflow-auto"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(32px, 44px))`,
        }}
      >
        {matrix.map((row, r) =>
          row.map((val, c) => {
            // Heatmap color or grayscale
            let bg = `rgb(${val}, ${val}, ${val})`;
            if (heatmap) {
              const hue = (1 - val / 255) * 240; // blue to red
              bg = `hsl(${hue}, 85%, 50%)`;
            }
            const textColor = val > 128 && !heatmap ? '#111214' : '#FFFFFF';

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                title={`Pixel f(${r},${c}) = ${val} (click to edit)`}
                className="aspect-square flex items-center justify-center rounded-lg cursor-pointer transition-transform hover:scale-105 hover:ring-2 hover:ring-accent shadow-inner text-xs font-mono font-bold"
                style={{ backgroundColor: bg, color: textColor }}
              >
                {showNumbers && <span>{val}</span>}
              </div>
            );
          })
        )}
      </div>

      <div className="mt-2 text-[11px] text-text-muted font-mono">
        Matrix Size: {rows}×{cols} • Click any cell to modify intensity
      </div>
    </div>
  );
};
