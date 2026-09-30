import React from 'react';

export interface BeginnerExplainProps {
  /** 💡 Real-world analogy, jargon-free explanation */
  concept: React.ReactNode;
  /** 🎛️ How the controls map to intuitive visual changes */
  controls: React.ReactNode;
  /** 👀 Concrete visual experiments to try with the live preview */
  whatToLookFor: React.ReactNode;
  /** 🌟 Real-life impact, fun trivia, camera/filter application */
  whyItMatters: React.ReactNode;
}

export interface AdvancedExplainProps {
  /** 📐 Formal mathematical equations, transfer functions, matrix formulation */
  math: React.ReactNode;
  /** 🧠 Computational pipeline, algorithmic complexity, boundary handling */
  algorithm: React.ReactNode;
  /** 🔬 Sensitivity analysis, edge cases, frequency response */
  parameterImpact: React.ReactNode;
  /** 🚀 Real-world engineering systems (biomedical, remote sensing, CV pipelines) */
  applications: React.ReactNode;
}

export interface DualViewExplainProps {
  mode: 'beginner' | 'advanced';
  beginner: BeginnerExplainProps;
  advanced: AdvancedExplainProps;
}

export const DualViewExplain: React.FC<DualViewExplainProps> = ({
  mode,
  beginner,
  advanced,
}) => {
  if (mode === 'beginner') {
    return (
      <div className="space-y-3.5">
        {/* 💡 Concept in Plain English */}
        <section className="rounded-2xl p-3 bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20">
          <h3 className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
            <span className="text-sm">💡</span> Concept in Plain English
          </h3>
          <div className="text-xs leading-relaxed text-text-light dark:text-text-dark space-y-1">
            {beginner.concept}
          </div>
        </section>

        {/* 🎛️ What Do These Controls Do? */}
        <section className="rounded-2xl p-3 bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20">
          <h3 className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
            <span className="text-sm">🎛️</span> What Do These Controls Do?
          </h3>
          <div className="text-xs leading-relaxed text-text-light dark:text-text-dark space-y-1">
            {beginner.controls}
          </div>
        </section>

        {/* 👀 What to Look For in the Live Image */}
        <section className="rounded-2xl p-3 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20">
          <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
            <span className="text-sm">👀</span> What to Look For in the Live Image
          </h3>
          <div className="text-xs leading-relaxed text-text-light dark:text-text-dark space-y-1">
            {beginner.whatToLookFor}
          </div>
        </section>

        {/* 🌟 Why Does This Matter? */}
        <section className="rounded-2xl p-3 bg-purple-500/5 dark:bg-purple-500/10 border border-purple-500/20">
          <h3 className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
            <span className="text-sm">🌟</span> Why Does This Matter?
          </h3>
          <div className="text-xs leading-relaxed text-text-light dark:text-text-dark space-y-1">
            {beginner.whyItMatters}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* 📐 Formal Mathematical Definition & Transfer Functions */}
      <section className="rounded-2xl p-3 bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20">
        <h3 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
          <span className="text-sm">📐</span> Mathematical Formulation
        </h3>
        <div className="text-xs leading-relaxed text-text-light dark:text-text-dark space-y-1">
          {advanced.math}
        </div>
      </section>

      {/* 🧠 Algorithm Workflow & Kernel/Matrix Representation */}
      <section className="rounded-2xl p-3 bg-cyan-500/5 dark:bg-cyan-500/10 border border-cyan-500/20">
        <h3 className="text-xs font-bold text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
          <span className="text-sm">🧠</span> Algorithm Workflow & Complexity
        </h3>
        <div className="text-xs leading-relaxed text-text-light dark:text-text-dark space-y-1">
          {advanced.algorithm}
        </div>
      </section>

      {/* 🔬 Parameter Impact Analysis */}
      <section className="rounded-2xl p-3 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20">
        <h3 className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
          <span className="text-sm">🔬</span> Parameter Sensitivity & Boundaries
        </h3>
        <div className="text-xs leading-relaxed text-text-light dark:text-text-dark space-y-1">
          {advanced.parameterImpact}
        </div>
      </section>

      {/* 🚀 Industrial & Engineering Applications */}
      <section className="rounded-2xl p-3 bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20">
        <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 mb-1.5 uppercase tracking-wide">
          <span className="text-sm">🚀</span> Engineering Applications
        </h3>
        <div className="text-xs leading-relaxed text-text-light dark:text-text-dark space-y-1">
          {advanced.applications}
        </div>
      </section>
    </div>
  );
};
