import React, { useState } from 'react';
import { Step } from '../../engine/math/types';
import { StepList } from '../math/StepList';
import { Sigma, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';

interface AdvancedDrawerProps {
  steps: Step[];
  onHighlightStep?: (step: Step | null) => void;
  isOpen: boolean;
  onToggleOpen?: () => void;
}

export const AdvancedDrawer: React.FC<AdvancedDrawerProps> = ({
  steps,
  onHighlightStep,
  isOpen,
  onToggleOpen,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!isOpen) return null;

  return (
    <aside
      aria-label="Generative Math Derivations"
      className="mt-6 border-t border-border-light dark:border-border-dark pt-5 transition-all duration-200"
    >
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl p-4 shadow-sm">
        {/* Drawer Header */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between cursor-pointer select-none pb-2 border-b border-border-light dark:border-border-dark"
        >
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-accent text-white">
              <Sigma className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-light dark:text-text-dark flex items-center gap-1.5">
                Generative Mathematical Engine
                <span className="text-[10px] font-normal normal-case px-2 py-0.5 rounded-full bg-accent/10 text-accent font-mono">
                  Live Computed
                </span>
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                Derivations and algebraic steps computed in real time from your current slider parameters
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-1 rounded-lg text-text-muted hover:text-text-light dark:hover:text-text-dark"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Drawer Content */}
        {isExpanded && (
          <div className="mt-4">
            <StepList steps={steps} onHighlightStep={onHighlightStep} />
          </div>
        )}
      </div>
    </aside>
  );
};
