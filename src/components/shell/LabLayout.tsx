import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Footer } from './Footer';
import { AdvancedDrawer } from './AdvancedDrawer';
import { useAppStore } from '../../state/store';
import { Step } from '../../engine/math/types';
import { ChevronLeft, ChevronRight, RotateCcw, Sparkles } from 'lucide-react';

interface Preset {
  label: string;
  params: Record<string, any>;
}

interface LabLayoutProps {
  unitTitle: string;
  topicTitle: string;
  hook: string;
  prevTopic?: { slug: string; title: string };
  nextTopic?: { slug: string; title: string };
  presets?: Preset[];
  onApplyPreset?: (params: Record<string, any>) => void;
  onReset?: () => void;
  steps?: Step[];
  childrenStage: React.ReactNode;
  childrenControls: React.ReactNode;
  childrenExplain: React.ReactNode;
}

export const LabLayout: React.FC<LabLayoutProps> = ({
  unitTitle,
  topicTitle,
  hook,
  prevTopic,
  nextTopic,
  presets,
  onApplyPreset,
  onReset,
  steps = [],
  childrenStage,
  childrenControls,
  childrenExplain,
}) => {
  const navigate = useNavigate();
  const { viewMode, toggleViewMode } = useAppStore();

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if inside input/textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        navigate('/');
      } else if (e.key === 'ArrowLeft' && prevTopic) {
        navigate(`/topic/${prevTopic.slug}`);
      } else if (e.key === 'ArrowRight' && nextTopic) {
        navigate(`/topic/${nextTopic.slug}`);
      } else if (e.key.toLowerCase() === 'a') {
        toggleViewMode();
      } else if (e.key.toLowerCase() === 'r' && onReset) {
        onReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, prevTopic, nextTopic, toggleViewMode, onReset]);

  return (
    <div className="min-h-screen flex flex-col bg-bg-light dark:bg-bg-dark text-text-light dark:text-text-dark transition-colors">
      <TopBar unitTitle={unitTitle} topicTitle={topicTitle} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {/* Lab Header & Presets */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 pb-4 border-b border-border-light dark:border-border-dark">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent font-mono">
              {unitTitle}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-light dark:text-text-dark mt-0.5">
              {topicTitle}
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-1 max-w-2xl leading-relaxed">
              {hook}
            </p>
          </div>

          {/* Presets and Reset */}
          <div className="flex items-center flex-wrap gap-2">
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                title="Reset parameters (Key: R)"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-muted hover:text-text-light dark:hover:text-text-dark hover:border-accent/40 shadow-sm transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}

            {presets && presets.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-text-muted mr-0.5 font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-secondary" /> Presets:
                </span>
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onApplyPreset?.(preset.params)}
                    className="px-2.5 py-1 text-xs font-medium rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark hover:border-accent/50 hover:bg-accent/5 transition-all shadow-sm"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Two-region split: Stage (≈65%) and Controls/Explain (≈35%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left / Main: Stage */}
          <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
            <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-5 sm:p-6 shadow-sm">
              {childrenStage}
            </div>

            {/* Advanced Generative Math Drawer (when Advanced mode is on) */}
            {viewMode === 'advanced' && (
              <AdvancedDrawer steps={steps} isOpen={true} />
            )}
          </div>

          {/* Right / Side: Control & Explain panel */}
          <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5 sticky top-20">
            {/* Controls Panel */}
            <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-5 shadow-sm space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted pb-2 border-b border-border-light dark:border-border-dark">
                Interactive Controls
              </h2>
              {childrenControls}
            </div>

            {/* Explanation / Intuition */}
            <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-5 shadow-sm space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted pb-1 border-b border-border-light dark:border-border-dark flex items-center justify-between">
                <span>{viewMode === 'advanced' ? 'Formal Foundations' : 'Core Intuition'}</span>
                <span className="text-[10px] lowercase font-normal px-2 py-0.5 rounded-full bg-surface-mutedLight dark:bg-surface-mutedDark">
                  {viewMode}
                </span>
              </h2>
              <div className="text-xs sm:text-sm text-text-light dark:text-text-dark leading-relaxed space-y-2.5">
                {childrenExplain}
              </div>
            </div>
          </div>
        </div>

        {/* Prev / Next Navigation Bar */}
        <div className="mt-10 pt-6 border-t border-border-light dark:border-border-dark flex items-center justify-between gap-4">
          {prevTopic ? (
            <button
              onClick={() => navigate(`/topic/${prevTopic.slug}`)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:border-accent/50 text-left transition-all group"
            >
              <ChevronLeft className="w-4 h-4 text-accent group-hover:-translate-x-0.5 transition-transform" />
              <div>
                <div className="text-[10px] text-text-muted font-mono uppercase">Previous Topic</div>
                <div className="text-xs font-bold text-text-light dark:text-text-dark truncate max-w-[180px] sm:max-w-[240px]">
                  {prevTopic.title}
                </div>
              </div>
            </button>
          ) : (
            <div />
          )}

          {nextTopic && (
            <button
              onClick={() => navigate(`/topic/${nextTopic.slug}`)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:border-accent/50 text-right transition-all group ml-auto"
            >
              <div>
                <div className="text-[10px] text-text-muted font-mono uppercase">Next Topic</div>
                <div className="text-xs font-bold text-text-light dark:text-text-dark truncate max-w-[180px] sm:max-w-[240px]">
                  {nextTopic.title}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-accent group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};
