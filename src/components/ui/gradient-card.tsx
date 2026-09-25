// components/ui/gradient-card.tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/utils';

// Card background variants
const cardVariants = cva(
  'relative flex flex-col justify-between h-full w-full overflow-hidden rounded-2xl p-6 sm:p-8 shadow-sm transition-shadow duration-300 hover:shadow-lg',
  {
    variants: {
      gradient: {
        orange: 'bg-gradient-to-br from-orange-100 to-amber-200/50 dark:from-orange-950/40 dark:to-amber-900/20',
        gray: 'bg-gradient-to-br from-slate-100 to-slate-200/50 dark:from-slate-800/60 dark:to-slate-700/30',
        purple: 'bg-gradient-to-br from-purple-100 to-indigo-200/50 dark:from-purple-950/40 dark:to-indigo-900/20',
        green: 'bg-gradient-to-br from-emerald-100 to-teal-200/50 dark:from-emerald-950/40 dark:to-teal-900/20',
        blue: 'bg-gradient-to-br from-sky-100 to-blue-200/50 dark:from-sky-950/40 dark:to-blue-900/20',
      },
    },
    defaultVariants: { gradient: 'gray' },
  }
);

export interface GradientCardProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'>,
    VariantProps<typeof cardVariants> {
  badgeText: string;
  badgeColor: string; // hex, e.g. "#FF5733"
  title: React.ReactNode;
  description: React.ReactNode;
  ctaText?: string;
  /**
   * Original component decorated the corner with a remote <img>. This app has no network
   * image assets (it renders live SVG/canvas previews instead), so `thumbnail` accepts any
   * node — pass an <img src="..."> here too if you do have a real image URL.
   */
  thumbnail?: React.ReactNode;
}

const GradientCard = React.forwardRef<HTMLDivElement, GradientCardProps>(
  ({ className, gradient, badgeText, badgeColor, title, description, ctaText, thumbnail, children, ...props }, ref) => {
    const cardAnimation = { rest: { scale: 1, y: 0 }, hover: { scale: 1.02, y: -3 } };
    const thumbAnimation = { rest: { scale: 1, rotate: 0 }, hover: { scale: 1.08, rotate: 2 } };

    return (
      <motion.div variants={cardAnimation} initial="rest" whileHover="hover" animate="rest" className="h-full" ref={ref}>
        <div className={cn(cardVariants({ gradient }), className)} {...props}>
          {thumbnail && (
            <motion.div
              variants={thumbAnimation}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              className="absolute -right-6 -bottom-6 w-28 h-28 sm:w-32 sm:h-32 opacity-90 pointer-events-none dark:opacity-70"
            >
              {thumbnail}
            </motion.div>
          )}

          <div className="z-10 flex flex-col h-full">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/60 dark:bg-black/30 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-200 backdrop-blur-sm w-fit">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: badgeColor }} />
              {badgeText}
            </div>

            <div className="flex-grow min-w-0">
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-1.5 leading-snug">{title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-[85%]">{description}</p>
            </div>

            {children}

            {ctaText && (
              <span className="group mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white w-fit">
                {ctaText}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);
GradientCard.displayName = 'GradientCard';

export { GradientCard, cardVariants };
