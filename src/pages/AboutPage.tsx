import React from 'react';
import { TopBar } from '../components/shell/TopBar';
import { Footer } from '../components/shell/Footer';
import { Link } from 'react-router-dom';
import { Sparkles, Heart, ExternalLink, ArrowRight, CheckCircle2, Sigma, Activity, Layers } from 'lucide-react';

export const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col bg-bg-light dark:bg-bg-dark text-text-light dark:text-text-dark transition-colors">
      <TopBar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="space-y-10">
          {/* Header */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" /> About the Platform
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Intuitive, Manipulable Visuals for Image Processing
            </h1>
            <p className="text-sm sm:text-base text-text-muted leading-relaxed">
              DIP Lab was architected to empower the global student and engineering community by transforming abstract formulas and multi-step derivations into direct, manipulable experiences.
            </p>
          </div>

          {/* Core Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="p-5 rounded-3xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark space-y-2">
              <div className="w-8 h-8 rounded-xl bg-accent text-white flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm">Real-Time Manipulation</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                No &quot;Apply&quot; buttons or rendering spinners. Every slider change updates the mathematical curves and image raster within a single 60fps frame.
              </p>
            </div>

            <div className="p-5 rounded-3xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark space-y-2">
              <div className="w-8 h-8 rounded-xl bg-secondary text-white flex items-center justify-center">
                <Sigma className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm">Generative Math Engine</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Step-by-step calculus derivations and discrete sums are computed live on current parameter values, eliminating static textbook disconnect.
              </p>
            </div>

            <div className="p-5 rounded-3xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark space-y-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm">Progressive Disclosure</h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Switch seamlessly between <strong>Beginner</strong> intuition and <strong>Advanced</strong> rigorous mathematical notation and proofs with one persistent toggle.
              </p>
            </div>
          </div>

          {/* Creator Profile Spotlight */}
          <div className="p-6 sm:p-8 rounded-3xl border border-accent/30 bg-accent/5 dark:bg-accent/10 space-y-4">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
              <h2 className="text-base font-bold">Author & Vision</h2>
            </div>
            <p className="text-xs sm:text-sm text-text-light dark:text-text-dark leading-relaxed">
              This interactive platform was designed and created with care by{' '}
              <a
                href="https://www.linkedin.com/in/shuvam-vidyarthy/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-accent hover:underline inline-flex items-center gap-0.5"
              >
                Shuvam Vidyarthy
                <ExternalLink className="w-3.5 h-3.5 ml-0.5 inline" />
              </a>{' '}
              to make complex scientific disciplines accessible, playful, and mathematically transparent for learners everywhere.
            </p>
            <div className="pt-2">
              <a
                href="https://www.linkedin.com/in/shuvam-vidyarthy/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent-hover transition-colors shadow-sm"
              >
                Connect on LinkedIn <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Call to action */}
          <div className="text-center pt-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-accent text-white font-semibold text-xs sm:text-sm shadow-md hover:bg-accent-hover transition-all"
            >
              Start Exploring Topics <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
