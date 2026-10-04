import type { CSSProperties } from 'react';
import { STAGES } from './utils';

// A board card is filled with its stage's pastel. The pairs live on STAGES,
// beside the pill pairs, and color.test.ts asserts them against WCAG AA. As
// with folder colours (see folderColorVars), they travel as custom properties
// and the classes below pick the theme's pair with Tailwind's `dark:` variant,
// so a card follows the theme without reading ThemeContext.
export function stageCardVars(status: string): CSSProperties {
  const stage = STAGES.find((s) => s.id === status) ?? STAGES[0];
  return {
    '--sc-tint': stage.cardTint,
    '--sc-text': stage.cardText,
    '--sc-tint-dark': stage.cardTintDark,
    '--sc-text-dark': stage.cardTextDark,
    '--sc-dot': stage.color,
    '--sc-dot-dark': stage.textDark,
  } as CSSProperties;
}

// Each is one literal string so Tailwind's scanner sees every class.

/** The card's fill. */
export const stageCardFill = 'bg-[color:var(--sc-tint)] dark:bg-[color:var(--sc-tint-dark)]';

/** Stage-coloured text on the fill: chips and metadata, never the title. */
export const stageCardText = 'text-[color:var(--sc-text)] dark:text-[color:var(--sc-text-dark)]';

/** A small solid marker in the stage's colour, beside its name. */
export const stageDot = 'bg-[color:var(--sc-dot)] dark:bg-[color:var(--sc-dot-dark)]';
