import React, { useMemo } from 'react';

interface AreaPlotProps {
  data: Float64Array | number[]; // 256 PDF points
  range: [number, number]; // [a, b]
  width?: number;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  className?: string;
}

export const AreaPlot: React.FC<AreaPlotProps> = ({
  data,
  range,
  width = 300,
  height = 200,
  xLabel = 'Intensity (r)',
  yLabel = 'Probability Density p_r(r)',
  className = '',
}) => {
  const padLeft = 40;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 30;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const [a, b] = range;

  // Max density for scaling
  const maxVal = useMemo(() => {
    let m = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] > m) m = data[i];
    }
    return m > 0 ? m : 0.01;
  }, [data]);

  const scaleX = (x: number) => padLeft + (x / 255) * plotW;
  const scaleY = (y: number) => padTop + plotH - (y / maxVal) * plotH;

  // Build line path
  const curveD = useMemo(() => {
    if (data.length === 0) return '';
    return Array.from(data).reduce((acc, val, i) => {
      const x = scaleX(i);
      const y = scaleY(val);
      const cmd = i === 0 ? 'M' : 'L';
      return `${acc} ${cmd} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }, [data, maxVal, plotW, plotH]);

  // Build shaded area between [a, b]
  const areaD = useMemo(() => {
    if (data.length === 0 || a >= b) return '';
    const startX = scaleX(a);
    const endX = scaleX(b);
    const bottomY = padTop + plotH;

    let path = `M ${startX.toFixed(1)} ${bottomY.toFixed(1)}`;

    for (let i = a; i <= b; i++) {
      const x = scaleX(i);
      const y = scaleY(data[i] || 0);
      path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }

    path += ` L ${endX.toFixed(1)} ${bottomY.toFixed(1)} Z`;
    return path;
  }, [data, a, b, maxVal, plotW, plotH]);

  // Compute integral probability between a and b
  const probability = useMemo(() => {
    let sum = 0;
    for (let i = a; i <= b; i++) {
      sum += data[i] || 0;
    }
    return Math.min(1.0, sum);
  }, [data, a, b]);

  return (
    <div className={`relative select-none ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        aria-label="PDF area integration plot"
      >
        {/* Shaded Area */}
        {areaD && (
          <path
            d={areaD}
            fill="#5B5BF0"
            opacity="0.25"
          />
        )}

        {/* Continuous curve */}
        {curveD && (
          <path
            d={curveD}
            fill="none"
            stroke="#5B5BF0"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        )}

        {/* Bound Markers for a and b */}
        <line
          x1={scaleX(a)}
          y1={padTop}
          x2={scaleX(a)}
          y2={padTop + plotH}
          stroke="#10B981"
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />
        <text
          x={scaleX(a)}
          y={padTop - 4}
          fontSize="9"
          fontWeight="bold"
          fill="#10B981"
          textAnchor="middle"
        >
          a = {a}
        </text>

        <line
          x1={scaleX(b)}
          y1={padTop}
          x2={scaleX(b)}
          y2={padTop + plotH}
          stroke="#EC4899"
          strokeWidth="1.5"
          strokeDasharray="2 2"
        />
        <text
          x={scaleX(b)}
          y={padTop - 4}
          fontSize="9"
          fontWeight="bold"
          fill="#EC4899"
          textAnchor="middle"
        >
          b = {b}
        </text>

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

        {/* Ticks */}
        <text x={padLeft} y={padTop + plotH + 14} fontSize="9" fill="currentColor" className="text-text-muted" textAnchor="middle">0</text>
        <text x={padLeft + plotW / 2} y={padTop + plotH + 14} fontSize="9" fill="currentColor" className="text-text-muted" textAnchor="middle">128</text>
        <text x={padLeft + plotW} y={padTop + plotH + 14} fontSize="9" fill="currentColor" className="text-text-muted" textAnchor="middle">255</text>

        <text x={padLeft - 6} y={padTop + 6} fontSize="9" fill="currentColor" className="text-text-muted" textAnchor="end">
          {maxVal.toFixed(3)}
        </text>

        {/* Readout label */}
        <text
          x={padLeft + plotW / 2}
          y={padTop + 24}
          fontSize="11"
          fontWeight="bold"
          fill="#5B5BF0"
          textAnchor="middle"
        >
          P({a} ≤ r ≤ {b}) = {(probability * 100).toFixed(2)}%
        </text>

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
      </svg>
    </div>
  );
};
