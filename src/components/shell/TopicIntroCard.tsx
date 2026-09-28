import React, { useState } from 'react';
import { TopicIntro } from '../../content/topicIntros';
import { BookOpen, ChevronDown, ChevronUp, Sparkles, Eye, Compass, Lightbulb } from 'lucide-react';

interface TopicIntroCardProps {
  intro: TopicIntro;
  defaultExpanded?: boolean;
}

export const TopicIntroCard: React.FC<TopicIntroCardProps> = ({
  intro,
  defaultExpanded = true,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-accent/20 dark:border-accent/30 rounded-3xl p-4 sm:p-5 shadow-sm mb-4 transition-all">
      {/* Top Header / Bar */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-2xl bg-accent/10 text-accent shrink-0 mt-0.5">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-bold tracking-wider font-mono text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                Topic Guide
              </span>
              <span className="text-xs text-text-muted font-medium">
                {intro.unit}
              </span>
            </div>
            <h2 className="text-sm sm:text-base font-bold text-text-light dark:text-text-dark mt-1">
              Introduction: {intro.title}
            </h2>
            <p className="text-xs sm:text-sm text-text-muted mt-0.5 leading-relaxed">
              {intro.concept}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent/80 px-2.5 py-1 rounded-xl bg-accent/5 hover:bg-accent/10 border border-accent/20 transition-colors"
          aria-expanded={expanded}
          title={expanded ? 'Collapse introduction guide' : 'Expand introduction guide'}
        >
          <span>{expanded ? 'Hide Guide' : 'Show Guide'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Walkthrough Body */}
      {expanded && (
        <div className="mt-4 pt-3.5 border-t border-border-light dark:border-border-dark grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          {/* Panel 1: What You Are Seeing */}
          <div className="bg-surface-mutedLight dark:bg-surface-mutedDark p-3.5 rounded-2xl border border-border-light dark:border-border-dark space-y-1.5">
            <div className="font-semibold text-text-light dark:text-text-dark flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
              <Eye className="w-3.5 h-3.5 text-accent" />
              What You Are Seeing On Screen
            </div>
            <p className="text-text-muted leading-relaxed">
              {intro.whatYouSee}
            </p>
          </div>

          {/* Panel 2: What to Try / Interactive Experiments */}
          <div className="bg-surface-mutedLight dark:bg-surface-mutedDark p-3.5 rounded-2xl border border-border-light dark:border-border-dark space-y-1.5">
            <div className="font-semibold text-text-light dark:text-text-dark flex items-center gap-1.5 text-[11px] uppercase tracking-wide">
              <Compass className="w-3.5 h-3.5 text-secondary" />
              What To Try (Step-by-Step)
            </div>
            <ul className="text-text-muted space-y-1 list-disc list-inside leading-relaxed marker:text-secondary">
              {intro.whatToTry.map((step, idx) => (
                <li key={idx} className="pl-1">
                  {step}
                </li>
              ))}
            </ul>
          </div>

          {/* Real-World Context Footer */}
          {intro.whyItMatters && (
            <div className="md:col-span-2 flex items-center gap-2 px-3.5 py-2 rounded-xl bg-accent/5 border border-accent/15 text-[11px] text-text-muted">
              <Lightbulb className="w-3.5 h-3.5 text-accent shrink-0" />
              <span>
                <strong className="text-text-light dark:text-text-dark font-medium">Real-world application: </strong>
                {intro.whyItMatters}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
