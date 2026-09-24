import React, { useState } from 'react';
import { Step } from '../../engine/math/types';
import { KatexView } from './KatexView';
import { Copy, Check, Info } from 'lucide-react';

interface StepCardProps {
  step: Step;
  stepNumber: number;
  isSelected?: boolean;
  onSelect?: (step: Step) => void;
}

export const StepCard: React.FC<StepCardProps> = ({
  step,
  stepNumber,
  isSelected = false,
  onSelect,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(step.latex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      onClick={() => onSelect?.(step)}
      className={`relative p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
        isSelected
          ? 'bg-accent/5 border-accent shadow-sm ring-1 ring-accent/30'
          : 'bg-surface-light dark:bg-surface-dark border-border-light dark:border-border-dark hover:border-accent/40'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-5 h-5 text-xs font-semibold rounded-full bg-accent text-white">
            {stepNumber}
          </span>
          <h4 className="text-sm font-semibold text-text-light dark:text-text-dark">
            {step.title}
          </h4>
        </div>
        <button
          onClick={handleCopy}
          title="Copy LaTeX formula"
          className="p-1 rounded text-text-muted hover:text-text-light dark:hover:text-text-dark hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Symbolic Expression */}
      <div className="py-1 overflow-x-auto text-center text-sm">
        <KatexView math={step.latex} displayMode />
      </div>

      {/* Live Substituted Numbers */}
      {step.substituted && (
        <div className="mt-2 pt-2 border-t border-dashed border-border-light dark:border-border-dark text-xs font-mono text-accent dark:text-accent-hover bg-accent-light/40 dark:bg-accent-dark/30 p-2 rounded-lg overflow-x-auto">
          <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted block mb-0.5">
            Live Evaluated:
          </span>
          {step.substituted}
        </div>
      )}

      {/* Rationale explanation */}
      {step.rationale && (
        <p className="mt-2 text-xs text-text-muted flex items-start gap-1.5 leading-relaxed">
          <Info className="w-3.5 h-3.5 mt-0.5 text-accent shrink-0" />
          <span>{step.rationale}</span>
        </p>
      )}
    </div>
  );
};
