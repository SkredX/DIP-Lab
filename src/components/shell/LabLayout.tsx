import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Footer } from './Footer';
import { AdvancedDrawer } from './AdvancedDrawer';
import { useAppStore } from '../../state/store';
import { Step } from '../../engine/math/types';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RotateCcw, Sparkles, SlidersHorizontal, Image as ImageIcon } from 'lucide-react';
import { TopicIntro } from '../../content/topicIntros';
import { TopicIntroCard } from './TopicIntroCard';

interface Preset {
  label: string;
  params: Record<string, any>;
}

interface LabLayoutProps {
  unitTitle: string;
  topicTitle: string;
  hook: string;
  topicIntro?: TopicIntro;
  prevTopic?: { slug: string; title: string };
  nextTopic?: { slug: string; title: string };
  presets?: Preset[];
  onApplyPreset?: (params: Record<string, any>) => void;
  onReset?: () => void;
  steps?: Step[];
  childrenStage: React.ReactNode;
  childrenControls: React.ReactNode;
  /** Image source picker; shown in a collapsible section below the parameter controls. */
  childrenImage?: React.ReactNode;
  childrenExplain: React.ReactNode;
}

export const LabLayout: React.FC<LabLayoutProps> = ({
  unitTitle,
  topicTitle,
  hook,
  topicIntro,
  prevTopic,
  nextTopic,
  presets,
  onApplyPreset,
  onReset,
  steps = [],
  childrenStage,
  childrenControls,
  childrenImage,
  childrenExplain,
}) => {
  const navigate = useNavigate();
  const { viewMode, toggleViewMode } = useAppStore();
  const [sheetOpen, setSheetOpen] = useState(true); // mobile bottom sheet
  const [imageOpen, setImageOpen] = useState(false);

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

  const presetBar = (
    <div className="flex items-center flex-wrap gap-1.5">
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          title="Reset parameters (Key: R)"
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-muted hover:text-text-light dark:hover:text-text-dark hover:border-accent/40 transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      )}
      {presets?.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => onApplyPreset?.(preset.params)}
          className="px-2.5 py-1 text-xs font-medium rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark hover:border-accent/50 hover:bg-accent/5 transition-all"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-bg-light dark:bg-bg-dark text-text-light dark:text-text-dark transition-colors">
      <TopBar unitTitle={unitTitle} topicTitle={topicTitle} />

      {/*
        Workbench layout (lg+): the preview and the controls are two independent scroll panes
        that each fill the viewport under the top bar, so sliders are always visible next to the
        live preview. Below lg the page scrolls and the controls dock in a bottom sheet.
      */}
      <main className="flex-1 min-h-0 w-full max-w-[1600px] mx-auto flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] lg:gap-5 lg:px-6 lg:pt-4 lg:pb-4">
        {/* ===== Left pane: header + preview stage + advanced math ===== */}
        <section
          className={`min-h-0 lg:overflow-y-auto lg:pr-1 px-4 pt-4 sm:px-6 lg:px-0 lg:pt-0 ${
            sheetOpen ? 'pb-[46vh]' : 'pb-24'
          } lg:pb-0`}
        >
          <div className="mb-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent font-mono">{unitTitle}</span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-light dark:text-text-dark mt-0.5">{topicTitle}</h1>
            <p className="text-xs sm:text-sm text-text-muted mt-1 max-w-3xl leading-relaxed">{hook}</p>
          </div>

          {topicIntro && <TopicIntroCard intro={topicIntro} />}

          <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-4 sm:p-6 shadow-sm">
            {childrenStage}
          </div>

          {viewMode === 'advanced' && <AdvancedDrawer steps={steps} isOpen={true} />}

          {/* Prev / Next */}
          <div className="mt-8 pt-5 border-t border-border-light dark:border-border-dark flex items-center justify-between gap-4">
            {prevTopic ? (
              <button
                onClick={() => navigate(`/topic/${prevTopic.slug}`)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:border-accent/50 text-left transition-all group"
              >
                <ChevronLeft className="w-4 h-4 text-accent group-hover:-translate-x-0.5 transition-transform" />
                <div>
                  <div className="text-[10px] text-text-muted font-mono uppercase">Previous Topic</div>
                  <div className="text-xs font-bold text-text-light dark:text-text-dark truncate max-w-[180px] sm:max-w-[240px]">{prevTopic.title}</div>
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
                  <div className="text-xs font-bold text-text-light dark:text-text-dark truncate max-w-[180px] sm:max-w-[240px]">{nextTopic.title}</div>
                </div>
                <ChevronRight className="w-4 h-4 text-accent group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
          <div className="mt-6 lg:hidden"><Footer /></div>
        </section>

        {/* ===== Right pane: controls (bottom sheet on small screens) ===== */}
        <aside
          aria-label="Controls"
          className={`fixed bottom-0 inset-x-0 z-30 lg:static lg:z-auto min-h-0 flex flex-col rounded-t-3xl lg:rounded-none border-t lg:border-0 border-border-light dark:border-border-dark bg-bg-light/95 dark:bg-bg-dark/95 backdrop-blur-xl lg:bg-transparent lg:dark:bg-transparent lg:backdrop-blur-none shadow-[0_-8px_30px_rgba(0,0,0,0.12)] lg:shadow-none ${
            sheetOpen ? 'max-h-[42vh]' : 'max-h-none'
          } lg:max-h-none`}
        >
          {/* Sheet handle (mobile only) */}
          <button
            type="button"
            onClick={() => setSheetOpen((v) => !v)}
            className="lg:hidden flex items-center justify-between w-full px-5 py-3 text-xs font-bold uppercase tracking-wider text-text-muted"
            aria-expanded={sheetOpen}
          >
            <span className="flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-accent" /> Controls</span>
            {sheetOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>

          <div className={`${sheetOpen ? 'block' : 'hidden'} lg:block min-h-0 overflow-y-auto px-4 pb-4 lg:px-0 lg:pb-0 lg:pr-1 space-y-4`}>
            {/* Parameters: always first, so they sit beside the live preview */}
            <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-4 shadow-sm space-y-3">
              <h2 className="hidden lg:flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-muted pb-2 border-b border-border-light dark:border-border-dark">
                <SlidersHorizontal className="w-3.5 h-3.5 text-accent" /> Interactive Controls
              </h2>
              {(onReset || (presets && presets.length > 0)) && (
                <div>
                  {presets && presets.length > 0 && (
                    <div className="text-[11px] text-text-muted mb-1.5 font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-secondary" /> Presets
                    </div>
                  )}
                  {presetBar}
                </div>
              )}
              {childrenControls}
            </div>

            {/* Image source (collapsed by default) */}
            {childrenImage && (
              <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl px-4 py-3 shadow-sm">
                <button
                  type="button"
                  onClick={() => setImageOpen((v) => !v)}
                  aria-expanded={imageOpen}
                  className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-text-muted hover:text-text-light dark:hover:text-text-dark"
                >
                  <span className="flex items-center gap-2"><ImageIcon className="w-3.5 h-3.5 text-accent" /> Image source</span>
                  {imageOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {imageOpen && <div className="mt-2">{childrenImage}</div>}
              </div>
            )}

            {/* Explanation */}
            <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted pb-2 border-b border-border-light dark:border-border-dark flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold text-text-light dark:text-text-dark">
                  {viewMode === 'advanced' ? (
                    <><span>🔬</span> Advanced View · Deep Dive</>
                  ) : (
                    <><span>🐣</span> Beginner View · Core Intuition</>
                  )}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-surface-mutedLight dark:bg-surface-mutedDark border border-border-light dark:border-border-dark">
                  {viewMode}
                </span>
              </h2>
              <div className="text-xs sm:text-sm text-text-light dark:text-text-dark leading-relaxed space-y-2.5">{childrenExplain}</div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};
