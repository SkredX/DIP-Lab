import React, { useMemo } from 'react';

interface Point {
  x: number;
  y: number;
}

interface LinePlotProps {
  data: number[] | Point[]; // array of 256 points or (x,y)
  secondaryData?: number[] | Point[];
  width?: number;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  showIdentity?: boolean;
  probedX?: number | null;
  tangentSlope?: number | null;
  className?: string;
}

export const LinePlot: React.FC<LinePlotProps> = ({
  data,
  secondaryData,
  width = 300,
  height = 200,
  xLabel = 'Input Intensity (r)',
  yLabel = 'Output Intensity (s)',
  showIdentity = true,
  probedX = null,
  tangentSlope = null,
  className = '',
}) => {
  const padLeft = 36;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 32;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const points: Point[] = useMemo(() => {
    if (data.length === 0) return [];
    if (typeof data[0] === 'number') {
      const nums = data as number[];
      const maxX = nums.length - 1 || 1;
      return nums.map((y, i) => ({
        x: (i / maxX) * 255,
        y: y,
      }));
    }
    return data as Point[];
  }, [data]);

  const secPoints: Point[] = useMemo(() => {
    if (!secondaryData || secondaryData.length === 0) return [];
    if (typeof secondaryData[0] === 'number') {
      const nums = secondaryData as number[];
      const maxX = nums.length - 1 || 1;
      return nums.map((y, i) => ({
        x: (i / maxX) * 255,
        y: y,
      }));
    }
    return secondaryData as Point[];
  }, [secondaryData]);

  // Scale function
  const scaleX = (x: number) => padLeft + (x / 255) * plotW;
  const scaleY = (y: number) => padTop + plotH - (y / 255) * plotH;

  // Build SVG path
  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, p, i) => {
      const cmd = i === 0 ? 'M' : 'L';
      return `${acc} ${cmd} ${scaleX(p.x).toFixed(1)} ${scaleY(p.y).toFixed(1)}`;
    }, '');
  }, [points, plotW, plotH]);

  const secPathD = useMemo(() => {
    if (secPoints.length === 0) return '';
    return secPoints.reduce((acc, p, i) => {
      const cmd = i === 0 ? 'M' : 'L';
      return `${acc} ${cmd} ${scaleX(p.x).toFixed(1)} ${scaleY(p.y).toFixed(1)}`;
    }, '');
  }, [secPoints, plotW, plotH]);

  // Probed point & tangent calculation
  const probedY = useMemo(() => {
    if (probedX === null || probedX === undefined || points.length === 0) return null;
    const idx = Math.max(0, Math.min(points.length - 1, Math.round((probedX / 255) * (points.length - 1))));
    return points[idx]?.y ?? null;
  }, [probedX, points]);

  return (
    <div className={`relative select-none ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        aria-label="Transformation curve plot"
      >
        {/* Background grid */}
        <line
          x1={padLeft}
          y1={scaleY(128)}
          x2={padLeft + plotW}
          y2={scaleY(128)}
          stroke="currentColor"
          className="text-border-light dark:text-border-dark opacity-60"
          strokeDasharray="3 3"
        />
        <line
          x1={scaleX(128)}
          y1={padTop}
          x2={scaleX(128)}
          y2={padTop + plotH}
          stroke="currentColor"
          className="text-border-light dark:text-border-dark opacity-60"
          strokeDasharray="3 3"
        />

        {/* Axes */}
        <line
          x1={padLeft}
          y1={padTop + plotH}
          x2={padLeft + plotW}
          y2={padTop + plotH}
          stroke="currentColor"
          className="text-text-muted"
          strokeWidth="1.2"
        />
        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={padTop + plotH}
          stroke="currentColor"
          className="text-text-muted"
          strokeWidth="1.2"
        />

        {/* Ticks and Labels */}
        <text x={padLeft} y={padTop + plotH + 16} fontSize="10" fill="currentColor" className="text-text-muted" textAnchor="middle">0</text>
        <text x={padLeft + plotW / 2} y={padTop + plotH + 16} fontSize="10" fill="currentColor" className="text-text-muted" textAnchor="middle">128</text>
        <text x={padLeft + plotW} y={padTop + plotH + 16} fontSize="10" fill="currentColor" className="text-text-muted" textAnchor="middle">255</text>

        <text x={padLeft - 8} y={padTop + plotH + 3} fontSize="10" fill="currentColor" className="text-text-muted" textAnchor="end">0</text>
        <text x={padLeft - 8} y={scaleY(128) + 3} fontSize="10" fill="currentColor" className="text-text-muted" textAnchor="end">128</text>
        <text x={padLeft - 8} y={padTop + 4} fontSize="10" fill="currentColor" className="text-text-muted" textAnchor="end">255</text>

        {/* Axis Titles */}
        <text
          x={padLeft + plotW / 2}
          y={height - 2}
          fontSize="10"
          fontWeight="500"
          fill="currentColor"
          className="text-text-muted"
          textAnchor="middle"
        >
          {xLabel}
        </text>

        {/* Identity line s = r */}
        {showIdentity && (
          <line
            x1={scaleX(0)}
            y1={scaleY(0)}
            x2={scaleX(255)}
            y2={scaleY(255)}
            stroke="currentColor"
            className="text-text-muted opacity-40"
            strokeDasharray="4 4"
            strokeWidth="1.2"
          />
        )}

        {/* Secondary curve (e.g. comparison or target) */}
        {secPathD && (
          <path
            d={secPathD}
            fill="none"
            stroke="#F0895B"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        )}

        {/* Primary curve */}
        {pathD && (
          <path
            d={pathD}
            fill="none"
            stroke="#5B5BF0"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Tangent line at probed point */}
        {probedX !== null && probedY !== null && tangentSlope !== null && (
          <line
            x1={scaleX(Math.max(0, probedX - 35))}
            y1={scaleY(Math.max(0, Math.min(255, probedY - tangentSlope * 35)))}
            x2={scaleX(Math.min(255, probedX + 35))}
            y2={scaleY(Math.max(0, Math.min(255, probedY + tangentSlope * 35)))}
            stroke="#10B981"
            strokeWidth="2"
            strokeDasharray="2 2"
          />
        )}

        {/* Probed point marker */}
        {probedX !== null && probedY !== null && (
          <g>
            <line
              x1={scaleX(probedX)}
              y1={padTop + plotH}
              x2={scaleX(probedX)}
              y2={scaleY(probedY)}
              stroke="#5B5BF0"
              strokeDasharray="2 2"
              strokeWidth="1"
              opacity="0.8"
            />
            <circle
              cx={scaleX(probedX)}
              cy={scaleY(probedY)}
              r="4.5"
              fill="#5B5BF0"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
            <text
              x={scaleX(probedX)}
              y={scaleY(probedY) - 8}
              fontSize="10"
              fontWeight="600"
              fill="#5B5BF0"
              textAnchor="middle"
            >
              ({Math.round(probedX)}, {Math.round(probedY)})
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};
