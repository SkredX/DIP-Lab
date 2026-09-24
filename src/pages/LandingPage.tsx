import React, { useState, useMemo } from 'react';
import { TopBar } from '../components/shell/TopBar';
import { Footer } from '../components/shell/Footer';
import { TopicCard } from '../components/shell/TopicCard';
import { UNITS, TOPICS } from '../content/registry';
import { Search, Sparkles, BookOpen, Layers, Cpu, Compass } from 'lucide-react';

export const LandingPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return TOPICS;
    const q = searchQuery.toLowerCase();
    return TOPICS.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.hook.toLowerCase().includes(q) ||
        t.slug.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-text-light dark:text-text-dark transition-colors">
      <TopBar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col">
        {/* Hero Section */}
        <section className="text-center max-w-3xl mx-auto space-y-4 mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass text-accent text-xs font-semibold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            Interactive Visual Learning Platform
          </div>

          <h1 className="text-3xl sm:text-5xl font-semibold tracking-[-0.035em] text-text-light dark:text-text-dark leading-tight">
            Learn Image Processing <br className="hidden sm:inline" />
            <span className="text-accent">
              by touching it
            </span>
          </h1>

          <p className="text-sm sm:text-base text-text-muted leading-relaxed max-w-2xl mx-auto">
            Directly manipulate mathematical parameters, observe real-time 60fps image reactions, and unfold generative step-by-step calculus derivations computed on live state.
          </p>

          {/* Quick Metrics Bar */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-6 text-xs text-text-muted font-mono">
            <span className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-accent" /> {UNITS.length} Curriculum Units
            </span>
            <span className="opacity-40">•</span>
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-secondary" /> {TOPICS.length} Interactive Labs
            </span>
            <span className="opacity-40">•</span>
            <span className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-emerald-500" /> Generative Step Engine
            </span>
          </div>

          {/* Search bar */}
          <div className="pt-4 max-w-md mx-auto">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-text-muted absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search topics (e.g. equalization, gamma, matrix, cdf)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-full glass text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-accent transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-xs text-text-muted hover:text-text-light dark:hover:text-text-dark"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Units & Topic Cards Grid */}
        <div className="space-y-12">
          {UNITS.map((unit) => {
            const unitTopics = filteredTopics.filter((t) => t.unitId === unit.id);
            if (unitTopics.length === 0) return null;

            return (
              <section key={unit.id} className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-3 border-b border-border-light dark:border-border-dark">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-text-light dark:text-text-dark">
                      {unit.title}
                    </h2>
                    <p className="text-xs text-text-muted mt-1 max-w-2xl leading-relaxed">
                      {unit.description}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-accent font-semibold self-start sm:self-auto">
                    {unitTopics.length} {unitTopics.length === 1 ? 'Topic' : 'Topics'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {unitTopics.map((topic) => (
                    <TopicCard
                      key={topic.slug}
                      slug={topic.slug}
                      title={topic.title}
                      hook={topic.hook}
                      unitTitle={unit.title}
                      order={topic.order}
                      difficulty={topic.difficulty}
                      thumbnailType={topic.thumbnail}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {filteredTopics.length === 0 && (
            <div className="text-center py-16 text-text-muted">
              <Compass className="w-8 h-8 mx-auto mb-2 text-text-muted opacity-50" />
              <p className="text-sm font-medium">No topics match &quot;{searchQuery}&quot;</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 text-xs text-accent font-semibold hover:underline"
              >
                Reset search query
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};
