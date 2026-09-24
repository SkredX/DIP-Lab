import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart2, Activity, Grid, Sliders, TrendingUp, Layers } from 'lucide-react';

export interface TopicCardProps {
  slug: string;
  title: string;
  hook: string;
  unitTitle: string;
  order: number;
  difficulty?: number; // 1 to 3
  thumbnailType?: 'histogram' | 'curve' | 'matrix' | 'levels' | 'cdf' | string;
}

export const TopicCard: React.FC<TopicCardProps> = ({
  slug,
  title,
  hook,
  unitTitle,
  order,
  difficulty = 1,
  thumbnailType = 'histogram',
}) => {
  return (
    <Link
      to={`/topic/${slug}`}
      className="group relative flex flex-col justify-between p-5 glass-card"
    >
      <div>
        {/* Top Header: Order & Micro Visual */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <span className="w-7 h-7 rounded-xl bg-surface-mutedLight dark:bg-surface-mutedDark text-text-muted font-mono font-bold text-xs flex items-center justify-center border border-border-light/60 dark:border-border-dark/60">
            {order < 10 ? `0${order}` : order}
          </span>

          {/* Micro Visual Thumbnail */}
          <div className="w-14 h-10 rounded-xl bg-accent/5 dark:bg-accent/10 border border-accent/20 flex items-center justify-center text-accent overflow-hidden group-hover:scale-105 group-hover:bg-accent/15 transition-all">
            {thumbnailType === 'histogram' && (
              <div className="flex items-end gap-1 h-6">
                <span className="w-1 h-2 bg-accent rounded-sm animate-pulse" />
                <span className="w-1 h-4 bg-accent rounded-sm animate-pulse delay-75" />
                <span className="w-1 h-5 bg-accent rounded-sm animate-pulse delay-150" />
                <span className="w-1 h-3 bg-accent rounded-sm animate-pulse delay-200" />
              </div>
            )}
            {thumbnailType === 'curve' && (
              <TrendingUp className="w-5 h-5 text-accent group-hover:rotate-6 transition-transform" />
            )}
            {thumbnailType === 'matrix' && (
              <Grid className="w-5 h-5 text-accent" />
            )}
            {thumbnailType === 'levels' && (
              <Layers className="w-5 h-5 text-accent" />
            )}
            {thumbnailType === 'cdf' && (
              <Activity className="w-5 h-5 text-accent" />
            )}
            {!['histogram', 'curve', 'matrix', 'levels', 'cdf'].includes(thumbnailType) && (
              <BarChart2 className="w-5 h-5 text-accent" />
            )}
          </div>
        </div>

        {/* Title & Hook */}
        <h3 className="text-base font-bold text-text-light dark:text-text-dark group-hover:text-accent transition-colors leading-snug">
          {title}
        </h3>
        <p className="mt-1.5 text-xs text-text-muted line-clamp-2 leading-relaxed">
          {hook}
        </p>
      </div>

      {/* Footer Info: Unit & Difficulty */}
      <div className="mt-5 pt-3 border-t border-border-light dark:border-border-dark flex items-center justify-between text-[11px] text-text-muted">
        <div className="flex items-center gap-1 font-mono">
          {Array.from({ length: 3 }).map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${
                i < difficulty ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            />
          ))}
          <span className="ml-1 text-[10px] text-text-muted">
            {difficulty === 1 ? 'Intro' : difficulty === 2 ? 'Intermediate' : 'Advanced'}
          </span>
        </div>

        <div className="flex items-center gap-1 text-accent font-semibold group-hover:translate-x-1 transition-transform">
          <span>Explore</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </Link>
  );
};
