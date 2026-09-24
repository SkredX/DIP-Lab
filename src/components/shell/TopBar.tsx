import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../state/store';
import { Sun, Moon, ArrowLeft, Layers, BookOpen, GraduationCap } from 'lucide-react';

interface TopBarProps {
  unitTitle?: string;
  topicTitle?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ unitTitle, topicTitle }) => {
  const navigate = useNavigate();
  const { viewMode, toggleViewMode, theme, toggleTheme } = useAppStore();

  return (
    <header className="sticky top-0 z-40 w-full h-14 border-b-[0.5px] border-border-light/70 dark:border-white/10 bg-bg-light/60 dark:bg-bg-dark/60 backdrop-blur-xl backdrop-saturate-150 transition-colors">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Left: Brand / Back */}
        <div className="flex items-center gap-3">
          {topicTitle ? (
            <button
              onClick={() => navigate('/')}
              className="p-1.5 rounded-lg border border-border-light dark:border-border-dark text-text-muted hover:text-text-light dark:hover:text-text-dark hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Back to topics (Esc)"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : null}

          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center font-bold text-xs shadow-sm group-hover:scale-105 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-text-light dark:text-text-dark">
                DIP<span className="text-accent">Lab</span>
              </span>
              <span className="text-[9px] uppercase tracking-wider text-text-muted -mt-1 font-mono">
                Interactive
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Breadcrumbs on Lab Pages */}
        {unitTitle && topicTitle ? (
          <nav className="hidden md:flex items-center gap-2 text-xs font-medium text-text-muted truncate">
            <span className="truncate max-w-[200px]">{unitTitle}</span>
            <span className="opacity-40">›</span>
            <span className="text-text-light dark:text-text-dark font-semibold truncate max-w-[240px]">
              {topicTitle}
            </span>
          </nav>
        ) : (
          <div className="hidden sm:flex items-center gap-2 text-xs text-text-muted font-medium">
            <span>Visual Foundations & Histogram Processing</span>
          </div>
        )}

        {/* Right: Beginner ⇄ Advanced Segmented Control + Theme */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Segmented View Mode Toggle */}
          <div className="inline-flex p-0.5 rounded-xl bg-surface-mutedLight dark:bg-surface-mutedDark border border-border-light dark:border-border-dark">
            <button
              type="button"
              onClick={() => viewMode !== 'beginner' && toggleViewMode()}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg transition-all ${
                viewMode === 'beginner'
                  ? 'bg-surface-light dark:bg-surface-dark text-text-light dark:text-text-dark font-semibold shadow-sm border border-border-light/60 dark:border-border-dark/60'
                  : 'text-text-muted hover:text-text-light dark:hover:text-text-dark'
              }`}
              title="Intuition first, clean controls, no clutter"
            >
              <BookOpen className="w-3.5 h-3.5 text-accent" />
              <span>Beginner</span>
            </button>
            <button
              type="button"
              onClick={() => viewMode !== 'advanced' && toggleViewMode()}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg transition-all ${
                viewMode === 'advanced'
                  ? 'bg-surface-light dark:bg-surface-dark text-accent font-semibold shadow-sm border border-border-light/60 dark:border-border-dark/60'
                  : 'text-text-muted hover:text-text-light dark:hover:text-text-dark'
              }`}
              title="Full math derivations, proofs, advanced sliders (Key: A)"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Advanced</span>
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-1.5 rounded-xl border border-border-light dark:border-border-dark text-text-muted hover:text-text-light dark:hover:text-text-dark hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
