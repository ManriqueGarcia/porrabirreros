import { memo } from "react";

const Pulse = ({ className = "", style }) => (
  <div className={`animate-pulse rounded bg-white/[.06] ${className}`} style={style} />
);

export const SkeletonCard = memo(function SkeletonCard() {
  return (
    <div className="card p-4 md:p-5 space-y-3">
      <Pulse className="h-5 w-40" />
      <Pulse className="h-3 w-56" />
      <div className="space-y-2 pt-2">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-center gap-3">
            <Pulse className="w-8 h-8 rounded-full flex-shrink-0" />
            <Pulse className="h-4 flex-1" />
            <Pulse className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
});

export const SkeletonNav = memo(function SkeletonNav() {
  return (
    <div className="flex gap-2 justify-center py-2">
      {[1, 2, 3, 4].map(i => (
        <Pulse key={i} className="h-9 w-20 rounded-xl" />
      ))}
    </div>
  );
});

export const SkeletonPage = memo(function SkeletonPage() {
  return (
    <div className="space-y-4">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
});
