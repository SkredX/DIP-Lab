import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart2, Activity, Grid, Layers, TrendingUp } from 'lucide-react';
import { GradientCard } from '@/components/ui/gradient-card';

export interface TopicCardProps {
  slug: string;
  title: string;
  hook: string;
  unitId: string;
  unitTitle: string;
  order: number;
  difficulty?: number; // 1 to 3
  thumbnailType?: 'histogram' | 'curve' | 'matrix' | 'levels' | 'cdf' | string;
}

// One gradient + accent colour per curriculum unit, so the whole unit reads as a set at a glance.
const UNIT_STYLE: Record<string, { gradient: 'gray' | 'purple' | 'green' | 'orange' | 'blue'; color: string }> = {
  'digital-image-fundamentals': { gradient: 'blue', color: '#0071E3' },
  'histogram-processing': { gradient: 'purple', color: '#8B5CF6' },
  'spatial-filtering': { gradient: 'green', color: '#10B981' },
  'bilateral-filtering': { gradient: 'orange', color: '#F0895B' },
  'image-formation-enhancement': { gradient: 'gray', color: '#64748B' },
};

const DIFFICULTY_LABEL = ['Intro', 'Intro', 'Intermediate', 'Advanced'];

// The decorative corner thumbnail: a small live-looking preview of what the lab is about,
// rendered locally (no network image) so it works fully offline.
const Thumbnail: React.FC<{ type: string; color: string }> = ({ type, color }) => {
  const common = 'w-full h-full flex items-center justify-center rounded-2xl';
  const bg = { background: `radial-gradient(circle at 65% 35%, ${color}33, transparent 70%)` };
  if (type === 'histogram')
    return (
      <div className={common} style={bg}>
        <div className="flex items-end gap-1 h-10">
          {[6, 10, 16, 22, 14, 8].map((h, i) => (
            <span key={i} className="w-1.5 rounded-sm animate-pulse" style={{ height: h, background: color, animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    );
  const Icon = type === 'curve' ? TrendingUp : type === 'matrix' ? Grid : type === 'levels' ? Layers : type === 'cdf' ? Activity : BarChart2;
  return (
    <div className={common} style={bg}>
      <Icon className="w-9 h-9" style={{ color }} />
    </div>
  );
};

export const TopicCard: React.FC<TopicCardProps> = ({ slug, title, hook, unitId, order, difficulty = 1, thumbnailType = 'histogram' }) => {
  const style = UNIT_STYLE[unitId] ?? UNIT_STYLE['digital-image-fundamentals'];
  return (
    <Link to={`/topic/${slug}`} className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-2xl">
      <GradientCard
        gradient={style.gradient}
        badgeText={`${order < 10 ? `0${order}` : order} · ${DIFFICULTY_LABEL[difficulty] ?? 'Intro'}`}
        badgeColor={style.color}
        title={title}
        description={hook}
        ctaText="Explore"
        thumbnail={<Thumbnail type={thumbnailType} color={style.color} />}
        className="group-hover:shadow-lg group-active:scale-[0.99] transition-transform"
      />
    </Link>
  );
};
