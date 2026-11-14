import { useCallback, useRef } from "react";

import type { Point } from "@/lib/hand/types";

export interface DwellSelection {
  progress: number;
  targetRect: DOMRect;
}

export function useDwellSelect() {
  const dwell = useRef<{ target: HTMLElement; since: number; fired: boolean } | null>(null);

  return useCallback((
    fingertip: Point | null,
    frame: HTMLElement | null,
    toolbar: HTMLElement | null,
    timestamp: number,
  ): { overToolbar: boolean; selection: DwellSelection | null } => {
    const bounds = frame?.getBoundingClientRect();
    const hit = fingertip && bounds
      ? document.elementFromPoint(bounds.left + (frame?.clientLeft ?? 0) + fingertip.x, bounds.top + (frame?.clientTop ?? 0) + fingertip.y)
      : null;
    const overToolbar = Boolean(hit && toolbar?.contains(hit));
    const target = overToolbar ? hit?.closest<HTMLElement>("[data-dwell]") : null;

    if (!target || target.matches(":disabled, [aria-disabled='true']")) {
      dwell.current = null;
      return { overToolbar, selection: null };
    }

    if (dwell.current?.target !== target) {
      dwell.current = { target, since: timestamp, fired: false };
    }

    if (dwell.current.fired) return { overToolbar, selection: null };

    const progress = Math.min(1, (timestamp - dwell.current.since) / 800);
    if (progress === 1) {
      dwell.current.fired = true;
      target.click();
      return { overToolbar, selection: null };
    }
    return { overToolbar, selection: { progress, targetRect: target.getBoundingClientRect() } };
  }, []);
}
