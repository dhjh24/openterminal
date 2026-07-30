import { useEffect, useState, type RefObject } from "react";

import { isValidChartSize } from "./safeChartCleanup";

export type ChartSize = { width: number; height: number };

/**
 * Observe a container and expose only positive dimensions.
 * Zero/negative resize events are ignored so charts are not created or resized invalidly.
 */
export function useValidChartSize(
  hostRef: RefObject<HTMLElement | null>,
  fallbackHeight = 520,
): ChartSize | null {
  const [size, setSize] = useState<ChartSize | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const measure = () => {
      const width = el.clientWidth;
      const height = el.clientHeight || fallbackHeight;
      if (!isValidChartSize(width, height)) return;
      setSize((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
    };

    measure();
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [hostRef, fallbackHeight]);

  return size;
}
