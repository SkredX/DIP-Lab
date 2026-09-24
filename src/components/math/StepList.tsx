import React, { useState } from 'react';
import { Step } from '../../engine/math/types';
import { StepCard } from './StepCard';
import { Play, RotateCcw, Eye, ChevronRight, ChevronLeft } from 'lucide-react';

interface StepListProps {
  steps: Step[];
  onHighlightStep?: (step: Step | null) => void;
}

export const StepList: React.FC<StepListProps> = ({ steps, onHighlightStep }) => {
  const [revealedCount, setRevealedCount] = useState<number>(steps.length);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const isSteppingMode = revealedCount < steps.length;

  const handleStepNext = () => {
    if (revealedCount < steps.length) {
      const nextCount = revealedCount + 1;
      setRevealedCount(nextCount);
      const activeStep = steps[nextCount - 1];
      setSelectedStepId(activeStep.id);
      onHighlightStep?.(activeStep);
    }
  };

  const handleStepPrev = () => {
    if (revealedCount > 1) {
      const nextCount = revealedCount - 1;
      setRevealedCount(nextCount);
      const activeStep = steps[nextCount - 1];
      setSelectedStepId(activeStep.id);
      onHighlightStep?.(activeStep);
    }
  };

  const handleShowAll = () => {
    setRevealedCount(steps.length);
    setSelectedStepId(null);
    onHighlightStep?.(null);
  };

  const handleStartStepThrough = () => {
    setRevealedCount(1);
    setSelectedStepId(steps[0].id);
    onHighlightStep?.(steps[0]);
  };

  const handleSelectStep = (step: Step) => {
    if (selectedStepId === step.id) {
      setSelectedStepId(null);
      onHighlightStep?.(null);
    } else {
      setSelectedStepId(step.id);
      onHighlightStep?.(step);
    }
  };

  if (!steps || steps.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-text-muted">
        No symbolic derivation steps available for this configuration.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Step controls */}
      <div className="flex items-center justify-between gap-2 p-2 bg-surface-mutedLight dark:bg-surface-mutedDark rounded-xl">
        <div className="flex items-center gap-1.5">
          {revealedCount < steps.length ? (
            <>
              <button
                onClick={handleStepPrev}
                disabled={revealedCount <= 1}
                className="p-1.5 rounded-lg border border-border-light dark:border-border-dark disabled:opacity-40 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                title="Previous step"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleStepNext}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono text-text-muted ml-2">
                {revealedCount} of {steps.length}
              </span>
            </>
          ) : (
            <button
              onClick={handleStartStepThrough}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border-light dark:border-border-dark hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <Play className="w-3.5 h-3.5 text-accent" />
              Step Through
            </button>
          )}
        </div>

        {revealedCount < steps.length && (
          <button
            onClick={handleShowAll}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-light dark:hover:text-text-dark"
          >
            <Eye className="w-3.5 h-3.5" />
            Show All
          </button>
        )}
      </div>

      {/* Cards list */}
      <div className="space-y-3">
        {steps.slice(0, revealedCount).map((step, idx) => (
          <StepCard
            key={step.id}
            step={step}
            stepNumber={idx + 1}
            isSelected={selectedStepId === step.id}
            onSelect={handleSelectStep}
          />
        ))}
      </div>
    </div>
  );
};
