// src/components/ui/gradient-card.demo.tsx
// Standalone usage reference for GradientCard, mirroring the original demo. Not routed
// in the app — the real integration (using local thumbnails, no network images) is in
// src/components/shell/TopicCard.tsx.
import { GradientCard } from '@/components/ui/gradient-card';

const cardData = [
  {
    badgeText: 'Open / Invite-priority',
    badgeColor: '#F59E0B',
    title: 'Companies',
    description: 'Build teams of highly motivated tech-professionals across the globe.',
    ctaText: 'Start hiring',
    thumbnail: <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=256&q=60" alt="" className="w-full h-full object-cover rounded-2xl" />,
    gradient: 'orange' as const,
  },
  {
    badgeText: 'Open for applications',
    badgeColor: '#4B5563',
    title: 'Builders',
    description: 'Work on your own terms in a motivating, healthy environment.',
    ctaText: 'Apply now',
    thumbnail: <img src="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=256&q=60" alt="" className="w-full h-full object-cover rounded-2xl" />,
    gradient: 'gray' as const,
  },
  {
    badgeText: 'Invite only',
    badgeColor: '#8B5CF6',
    title: 'Scouts',
    description: 'Use your network to refer new members and companies.',
    ctaText: 'Request invite',
    thumbnail: <img src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=256&q=60" alt="" className="w-full h-full object-cover rounded-2xl" />,
    gradient: 'purple' as const,
  },
  {
    badgeText: 'Invite only',
    badgeColor: '#10B981',
    title: 'Partners',
    description: 'Offer direct access to the society to your portfolio companies.',
    ctaText: 'Get in touch',
    thumbnail: <img src="https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?w=256&q=60" alt="" className="w-full h-full object-cover rounded-2xl" />,
    gradient: 'green' as const,
  },
];

export default function GradientCardDemo() {
  return (
    <div className="p-4 sm:p-8">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-10">
        {cardData.map((card, i) => (
          <GradientCard key={i} {...card} />
        ))}
      </div>
    </div>
  );
}
