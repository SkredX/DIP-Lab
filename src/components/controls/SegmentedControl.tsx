import React from 'react';

interface Option {
  value: string;
  label: string;
}

interface SegmentedControlProps {
  options: Option[];
  value: string;
  onChange: (val: string) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  options,
  value,
  onChange,
  className = '',
  size = 'md',
}) => {
  return (
    <div
      role="group"
      className={`inline-flex p-1 rounded-xl bg-surface-mutedLight dark:bg-surface-mutedDark border border-border-light dark:border-border-dark ${className}`}
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative rounded-lg font-medium transition-all duration-150 ${
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs'
            } ${
              isSelected
                ? 'bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark shadow-sm border border-border-light/60 dark:border-border-dark/60 font-semibold'
                : 'text-text-muted hover:text-text-light dark:hover:text-text-dark'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
