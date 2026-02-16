import { useState, useCallback, useRef } from "react";
import { PAGE_SIZE } from "../constants";

export function useInfiniteScroll<T>(allItems: T[]) {
  const [count, setCount] = useState(PAGE_SIZE);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            setCount((prev) => Math.min(prev + PAGE_SIZE, allItems.length));
          }
        },
        { threshold: 0.1 },
      );
      observerRef.current.observe(node);
    },
    [allItems.length],
  );

  const items = allItems.slice(0, count);
  const hasMore = count < allItems.length;

  return { items, hasMore, sentinelRef };
}
