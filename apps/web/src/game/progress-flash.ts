import { useEffect, useRef, type RefObject } from 'react';

/** Highlight a status bar in place whenever the progress it reports moves on: the same rule for the setup
 *  round and for the open reaction window, so the two bars read alike. Replaying it in place rather than
 *  remounting keeps focus on the status line and holds on to the live region it announces through. */
export function useProgressFlash<T extends HTMLElement>(progress: string): RefObject<T | null> {
  const box = useRef<T | null>(null);
  useEffect(() => {
    const box_ = box.current;
    if (!box_ || !progress) return;
    box_.classList.remove('flash'); void box_.offsetWidth; box_.classList.add('flash');
  }, [progress]);
  return box;
}
