export default function Loading() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-pulse select-none">
      {/* Top Search & Filter Skeleton */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
        <div className="h-10 w-full sm:w-80 rounded-xl bg-muted/70" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 rounded-lg bg-muted/60" />
          <div className="h-9 w-32 rounded-lg bg-muted/60" />
        </div>
      </div>

      {/* Tag Pills Skeleton */}
      <div className="flex items-center gap-2 overflow-hidden mb-8 py-1">
        <div className="h-8 w-20 rounded-full bg-muted/80 shrink-0" />
        <div className="h-8 w-24 rounded-full bg-muted/60 shrink-0" />
        <div className="h-8 w-28 rounded-full bg-muted/60 shrink-0" />
        <div className="h-8 w-20 rounded-full bg-muted/60 shrink-0" />
        <div className="h-8 w-24 rounded-full bg-muted/60 shrink-0" />
        <div className="h-8 w-32 rounded-full bg-muted/50 shrink-0" />
      </div>

      {/* Comic Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col rounded-2xl border border-border/50 bg-card/40 p-2 overflow-hidden shadow-xs"
          >
            {/* Cover Aspect Ratio 3:4 */}
            <div className="w-full aspect-[3/4] rounded-xl bg-muted/70 mb-3" />
            
            {/* Title Skeleton */}
            <div className="h-4 w-4/5 rounded bg-muted/80 mb-2" />
            
            {/* Subtitle / Chapter Count */}
            <div className="flex items-center justify-between">
              <div className="h-3 w-1/3 rounded bg-muted/50" />
              <div className="h-3 w-1/4 rounded bg-muted/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
