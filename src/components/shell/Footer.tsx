import React from 'react';
import { ExternalLink, Heart, Sparkles } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark py-6 px-4 transition-colors">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted text-center sm:text-left">
        <div className="flex items-center gap-1.5 font-medium">
          <Sparkles className="w-4 h-4 text-accent animate-pulse" />
          <span>
            Made for students, learners, and dreamers by{' '}
            <a
              href="https://www.linkedin.com/in/shuvam-vidyarthy/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-accent hover:underline inline-flex items-center gap-0.5 transition-colors"
            >
              Shuvam Vidyarthy
              <ExternalLink className="w-3 h-3 ml-0.5 inline opacity-70" />
            </a>
          </span>
        </div>

        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1">
            Built with <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> for intuitive visual education
          </span>
          <span className="opacity-40">•</span>
          <span>Digital Image Processing (DIP) Lab</span>
        </div>
      </div>
    </footer>
  );
};
