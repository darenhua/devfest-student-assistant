export function Sentinel({
  hasMore,
  sentinelRef,
}: {
  hasMore: boolean;
  sentinelRef: (node: HTMLDivElement | null) => void;
}) {
  if (!hasMore) return null;
  return <div ref={sentinelRef} className="h-8" />;
}
