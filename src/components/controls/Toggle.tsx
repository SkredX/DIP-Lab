import React from 'react';
import { getParamHelp } from '../../utils/paramHelp';

interface ToggleProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Plain-English explanation of what this switch does. Auto-detected from the label when omitted. */
  description?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  id,
  label,
  checked,
  onChange,
  description,
}) => {
  const helpText = description ?? getParamHelp(label, id);
  return (
    <div className="flex items-center justify-between py-1.5 gap-4">
      <div className="flex flex-col">
        <label htmlFor={id} className="text-xs font-medium text-text-light dark:text-text-dark cursor-pointer">
          {label}
        </label>
        {helpText && (
          <span className="text-[11px] text-text-muted">{helpText}</span>
        )}
      </div>

      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 ${
          checked ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-700'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};
