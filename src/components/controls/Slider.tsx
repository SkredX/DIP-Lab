import React from 'react';
import { useAppStore } from '../../state/store';
import { plainLabel } from '../../utils/plainLabel';

interface SliderProps {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  defaultValue?: number;
  unit?: string;
  onChange: (val: number) => void;
  advancedOnly?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  id,
  label,
  min,
  max,
  step,
  value,
  defaultValue,
  unit = '',
  onChange,
}) => {
  const handleDoubleClick = () => {
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    }
  };

  const { viewMode } = useAppStore();
  const shownLabel = plainLabel(label, viewMode);

  const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  return (
    <div className="space-y-1.5 py-1">
      <div className="flex items-center justify-between text-xs">
        <label htmlFor={id} className="font-medium text-text-light dark:text-text-dark">
          {shownLabel}
        </label>
        <div
          onDoubleClick={handleDoubleClick}
          title="Double-click to reset"
          className="font-mono text-accent font-semibold px-2 py-0.5 rounded bg-accent/10 cursor-pointer select-none"
        >
          {Number.isInteger(step) ? value : value.toFixed(2)}
          {unit && <span className="ml-0.5 text-text-muted">{unit}</span>}
        </div>
      </div>

      <div className="relative flex items-center h-8">
        <input
          type="range"
          id={id}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onDoubleClick={handleDoubleClick}
          className="w-full h-2 rounded-lg cursor-pointer accent-accent"
          style={{
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${percentage}%, var(--border) ${percentage}%, var(--border) 100%)`,
          }}
        />
      </div>

      <div className="flex justify-between text-[10px] text-text-muted font-mono">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
};
