import type { CSSProperties } from 'react';
import { FolderColor } from './types';

export interface FolderColorDef {
  id: FolderColor;
  label: string;
  /** The solid colour: folder icons, swatches, progress fills. Never behind text. */
  swatch: string;
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
  { id: 'blue', label: 'Blue', swatch: '#3b82f6',
    tint: '#e8f0fe', text: '#1d4ed8', tintDark: '#1c2a45', textDark: '#93b4f8' },
  { id: 'sky', label: 'Sky', swatch: '#0ea5e9',
    tint: '#e0f4fc', text: '#0369a1', tintDark: '#102f3d', textDark: '#7dd3fc' },
  { id: 'teal', label: 'Teal', swatch: '#14b8a6',
    tint: '#ddf6f2', text: '#115e59', tintDark: '#0f302c', textDark: '#5eead4' },
  { id: 'green', label: 'Green', swatch: '#22c55e',
    tint: '#e3f8ea', text: '#166534', tintDark: '#12301d', textDark: '#86efac' },
  { id: 'yellow', label: 'Yellow', swatch: '#eab308',
    tint: '#fdf6d8', text: '#854d0e', tintDark: '#33290c', textDark: '#fcd34d' },
  { id: 'orange', label: 'Orange', swatch: '#f97316',
    tint: '#feeedd', text: '#9a3412', tintDark: '#3a2213', textDark: '#fdba74' },
  { id: 'red', label: 'Red', swatch: '#ef4444',
    tint: '#fde8e8', text: '#b91c1c', tintDark: '#3d1a1a', textDark: '#fca5a5' },
  { id: 'pink', label: 'Pink', swatch: '#ec4899',
    tint: '#fce7f3', text: '#be185d', tintDark: '#3b1729', textDark: '#f9a8d4' },
  { id: 'purple', label: 'Purple', swatch: '#8b5cf6',
    tint: '#efe9fe', text: '#6d28d9', tintDark: '#2a1f45', textDark: '#c4b5fd' },
  { id: 'graphite', label: 'Graphite', swatch: '#6b7280',
    tint: '#eeeff1', text: '#4b5563', tintDark: '#2a2c30', textDark: '#c4c8cf' },
];

export const DEFAULT_FOLDER_COLOR: FolderColor = 'blue';

/** A stored value may predate colours or be hand-edited, so anything unknown is blue. */
export function folderColor(value: string | undefined): FolderColorDef {
  return FOLDER_COLORS.find((c) => c.id === value) ?? FOLDER_COLORS[0];
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
