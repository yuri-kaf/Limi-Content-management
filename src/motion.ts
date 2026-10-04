import type { CSSProperties } from 'react';

// Lists enter in a quick stagger the first time they render: each item starts
// a little after the one above it. CSS animations run on mount only, so a
// re-render never replays them, and index.css zeroes them for anyone who has
// asked for reduced motion. Capped, so the fortieth client is not left waiting
// a second for a decorative effect.
const STEP_MS = 30;
const CAP = 12;

export function staggerStyle(index: number): CSSProperties {
  return { animationDelay: `${Math.min(Math.max(index, 0), CAP) * STEP_MS}ms` };
}

/** The entrance itself. Its fill mode is `backwards`, so an item stays hidden through its delay. */
export const enter = 'animate-fade-up';
