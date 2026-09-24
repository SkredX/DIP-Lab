import React, { useMemo } from 'react';

interface BarPlotProps {
  data: Uint32Array | Float64Array | number[];
  secondaryData?: Uint32Array | Float64Array | number[];
  cdfData?: Float64Array | number[];
  width?: number;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  probedBin?: number | null;
  brushedRange?: [number, number] | null;
  onHoverBin?: (bin: number | null) => void;
  onClickBin?: (bin: number) => void;
  className?: string;
}

export const BarPlot: React.FC<BarPlotProps> = ({
  data,
  secondaryData,
  cdfData,
  width = 300,
  height = 200,
  xLabel = 'Intensity (r_k)',
  yLabel = 'Frequency',
  probedBin = null,
  brushedRange = null,
  onHoverBin,
  onClickBin,
  className = '',
}) => {
  const padLeft = 38;
  const padRight = cdfData ? 32 : 14;
  const padTop = 16;
  const padBottom = 30;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const numBins = data.length || 1;

  // Find max value for scaling
  const maxVal = useMemo(() => {
    let m = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] > m) m = data[i];
    }
    if (secondaryData) {
      for (let i = 0; i < secondaryData.length; i++) {
        if (secondaryData[i] > m) m = secondaryData[i];
      }
    }
    return m > 0 ? m : 1;
  }, [data, secondaryData]);

  const scaleX = (bin: number) => padLeft + (bin / numBins) * plotW;
  const scaleY = (val: number) => padTop + plotH - (val / maxVal) * plotH;
  const barW = Math.max(1, plotW / numBins);

  // CDF path
  const cdfPathD = useMemo(() => {
    if (!cdfData || cdfData.length === 0) return '';
    return Array.from(cdfData).reduce((acc, c, i) => {
      const x = padLeft + (i / (cdfData.length - 1 || 1)) * plotW;
      const y = padTop + plotH - c * plotH;
      const cmd = i === 0 ? 'M' : 'L';
      return `${acc} ${cmd} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }, '');
  }, [cdfData, plotW, plotH]);

  return (
    <div className={`relative select-none ${className}`}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible cursor-crosshair"
        onMouseLeave={() => onHoverBin?.(null)}
      >
        {/* Background Grid */}
        <line
          x1={padLeft}
          y1={padTop + plotH / 2}
          x2={padLeft + plotW}
          y2={padTop + plotH / 2}
          stroke="currentColor"
          className="text-border-light dark:text-border-dark opacity-50"
          strokeDasharray="3 3"
        />

        {/* Brushed range highlight background */}
        {brushedRange && (
          <rect
            x={padLeft + (brushedRange[0] / 255) * plotW}
            y={padTop}
            width={((brushedRange[1] - brushedRange[0]) / 255) * plotW}
            height={plotH}
            fill="#5B5BF0"
            opacity="0.12"
          />
        )}

        {/* Secondary bars (before/comparison) */}
        {secondaryData &&
          Array.from(secondaryData).map((val, i) => {
            const h = (val / maxVal) * plotH;
            const x = scaleX(i);
            const y = padTop + plotH - h;
            return (
              <rect
                key={`sec-${i}`}
                x={x}
                y={y}
                width={barW}
                height={h}
                fill="#F0895B"
                opacity="0.45"
              />
            );
          })}

        {/* Primary bars */}
        {Array.from(data).map((val, i) => {
          const intensityR = Math.round((i / (numBins - 1 || 1)) * 255);
          const isProbed = probedBin !== null && Math.abs(intensityR - probedBin) <= 256 / numBins / 2;
          const isInRange =
            brushedRange !== null &&
            intensityR >= brushedRange[0] &&
            intensityR <= brushedRange[1];

          const h = (val / maxVal) * plotH;
          const x = scaleX(i);
          const y = padTop + plotH - h;

          let fill = '#5B5BF0';
          if (isInRange) fill = '#10B981';
          if (isProbed) fill = '#EC4899';

          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={barW}
              height={h}
              fill={fill}
              opacity={isProbed || isInRange ? 1 : 0.85}
              onMouseEnter={() => onHoverBin?.(intensityR)}
              onClick={() => onClickBin?.(intensityR)}
            />
          );
        })}

        {/* CDF curve overlay */}
        {cdfPathD && (
          <path
            d={cdfPathD}
            fill="none"
            stroke="#EC4899"
            strokeWidth="2"
            strokeDasharray="3 2"
          />
        )}

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

        {/* Axis Ticks */}
        <text x={padLeft} y={padTop + plotH + 14} fontSize="9" fill="currentColor" className="text-text-muted" textAnchor="middle">0</text>
        <text x={padLeft + plotW / 2} y={padTop + plotH + 14} fontSize="9" fill="currentColor" className="text-text-muted" textAnchor="middle">128</text>
        <text x={padLeft + plotW} y={padTop + plotH + 14} fontSize="9" fill="currentColor" className="text-text-muted" textAnchor="middle">255</text>

        {/* Y Axis Max Label */}
        <text x={padLeft - 6} y={padTop + 6} fontSize="9" fill="currentColor" className="text-text-muted" textAnchor="end">
          {maxVal >= 1000 ? `${(maxVal / 1000).toFixed(1)}k` : maxVal < 1 ? maxVal.toFixed(3) : Math.round(maxVal)}
        </text>

        {/* Right axis label if CDF present */}
        {cdfData && (
          <text x={padLeft + plotW + 6} y={padTop + 6} fontSize="9" fill="#EC4899" textAnchor="start">
            1.0 CDF
          </text>
        )}

        {/* Axis Title */}
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

        {/* Probed intensity callout */}
        {probedBin !== null && (
          <g>
            <line
              x1={padLeft + (probedBin / 255) * plotW}
              y1={padTop}
              x2={padLeft + (probedBin / 255) * plotW}
              y2={padTop + plotH}
              stroke="#EC4899"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
            <text
              x={padLeft + (probedBin / 255) * plotW}
              y={padTop - 4}
              fontSize="10"
              fontWeight="600"
              fill="#EC4899"
              textAnchor="middle"
            >
              r = {probedBin}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};
