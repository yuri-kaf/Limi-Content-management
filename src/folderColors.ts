import type { CSSProperties } from 'react';
import { FolderColor } from './types';
import { contrastRatio } from './color';

export interface FolderColorDef {
  id: FolderColor;
  label: string;
  /** The solid colour: folder icons, swatches, progress fills. Never behind text. */
  swatch: string;
  /** The folder's front panel: the swatch lightened. The same in both themes, as in Finder. */
  front: string;
  /**
   * The letter embossed on the front. At least 3:1 on `front`, the bar for a
   * graphic, because it is decorative: the folder is `aria-hidden` and the name
   * is always written beside it.
   */
  emblem: string;
  /** Label background and text, light theme. */
  tint: string;
  text: string;
  /** Label background and text, dark theme. */
  tintDark: string;
  textDark: string;
}

// Chosen to read like the macOS Finder folder colours. Every text/tint pair is
// asserted against WCAG AA in folderColors.test.ts. Green, teal and orange use
// a darker text than the obvious Tailwind 700 because that measured within a
// rounding error of 4.5:1 on its tint.
export const FOLDER_COLORS: FolderColorDef[] = [
  { id: 'blue', label: 'Blue', swatch: '#3b82f6', front: '#85b2f9', emblem: '#1e417b',
    tint: '#e8f0fe', text: '#1d4ed8', tintDark: '#1c2a45', textDark: '#93b4f8' },
  { id: 'sky', label: 'Sky', swatch: '#0ea5e9', front: '#6ac7f1', emblem: '#075375',
    tint: '#e0f4fc', text: '#0369a1', tintDark: '#102f3d', textDark: '#7dd3fc' },
  { id: 'teal', label: 'Teal', swatch: '#14b8a6', front: '#6dd3c8', emblem: '#0a5c53',
    tint: '#ddf6f2', text: '#115e59', tintDark: '#0f302c', textDark: '#5eead4' },
  { id: 'green', label: 'Green', swatch: '#22c55e', front: '#76db9b', emblem: '#11632f',
    tint: '#e3f8ea', text: '#166534', tintDark: '#12301d', textDark: '#86efac' },
  { id: 'yellow', label: 'Yellow', swatch: '#eab308', front: '#f2d066', emblem: '#755a04',
    tint: '#fdf6d8', text: '#854d0e', tintDark: '#33290c', textDark: '#fcd34d' },
  { id: 'orange', label: 'Orange', swatch: '#f97316', front: '#fba86f', emblem: '#7d3a0b',
    tint: '#feeedd', text: '#9a3412', tintDark: '#3a2213', textDark: '#fdba74' },
  { id: 'red', label: 'Red', swatch: '#ef4444', front: '#f58b8b', emblem: '#782222',
    tint: '#fde8e8', text: '#b91c1c', tintDark: '#3d1a1a', textDark: '#fca5a5' },
  { id: 'pink', label: 'Pink', swatch: '#ec4899', front: '#f38ec0', emblem: '#76244d',
    tint: '#fce7f3', text: '#be185d', tintDark: '#3b1729', textDark: '#f9a8d4' },
  { id: 'purple', label: 'Purple', swatch: '#8b5cf6', front: '#b79af9', emblem: '#462e7b',
    tint: '#efe9fe', text: '#6d28d9', tintDark: '#2a1f45', textDark: '#c4b5fd' },
  { id: 'graphite', label: 'Graphite', swatch: '#6b7280', front: '#a3a8b0', emblem: '#363940',
    tint: '#eeeff1', text: '#4b5563', tintDark: '#2a2c30', textDark: '#c4c8cf' },
];

export const DEFAULT_FOLDER_COLOR: FolderColor = 'blue';

/** A stored value may predate colours or be hand-edited, so anything unknown is the default. */
export function folderColor(value: string | undefined): FolderColorDef {
  return (
    FOLDER_COLORS.find((c) => c.id === value) ??
    FOLDER_COLORS.find((c) => c.id === DEFAULT_FOLDER_COLOR)!
  );
}

// An inline style cannot express a dark-mode variant, and reading the theme
// from context would make every coloured label depend on ThemeProvider. These
// custom properties carry both pairs; `folderTint` picks one with Tailwind's
// `dark:` variant, so the label follows the theme with no JavaScript at all.
export function folderColorVars(value: string | undefined): CSSProperties {
  const c = folderColor(value);
  return {
    '--fc-swatch': c.swatch,
    '--fc-tint': c.tint,
    '--fc-text': c.text,
    '--fc-tint-dark': c.tintDark,
    '--fc-text-dark': c.textDark,
  } as CSSProperties;
}

/** Pair with folderColorVars(). One literal string so Tailwind's scanner sees every class. */
export const folderTint =
  'bg-[color:var(--fc-tint)] text-[color:var(--fc-text)] dark:bg-[color:var(--fc-tint-dark)] dark:text-[color:var(--fc-text-dark)]';

/**
 * Which tick reads on a swatch: white all but disappears on a light swatch, so
 * one where white measures under 3:1 takes an ink tick. 3:1 is the bar for a
 * graphic.
 */
export function swatchTick(swatch: string): 'white' | 'ink' {
  return contrastRatio('#ffffff', swatch) >= 3 ? 'white' : 'ink';
}
