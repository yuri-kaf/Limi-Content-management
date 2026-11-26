/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Google Sans Flex, as in Watchtower HQ: the Material 3 face.
        sans: ['"Google Sans Flex"', '"Google Sans"', 'Roboto', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Material 3, neutral register (see docs/council/2026-11-24-m3-redesign).
        // Pure white work area, light grey chrome, Limi red as the one brand
        // colour. Every text tier clears WCAG AA on canvas, tint, raised and
        // hover in both themes (src/color.test.ts).
        canvas: { DEFAULT: '#ffffff', dark: '#141316' },
        surface: { DEFAULT: '#ffffff', dark: '#141316' },
        // App chrome: the rail, the top bar and the drawer sit on this.
        tint: { DEFAULT: '#f3f3f4', dark: '#1c1b1f' },
        // Surface container low: cards and filled fields on white.
        raised: { DEFAULT: '#f6f6f7', dark: '#211f24' },
        // Surface container high: tonal buttons, hovered rows, selected chips.
        hover: { DEFAULT: '#eaeaec', dark: '#2b292f' },
        // Outline variant: the few rules that remain (dividers, tab rows).
        hairline: { DEFAULT: '#e1e0e4', dark: '#36343a' },
        // Outline: the edge of outlined controls (segmented buttons).
        outline: { DEFAULT: '#8b8990', dark: '#938f99' },
        // Surface container highest: a tonal button under the pointer.
        pressed: { DEFAULT: '#e0e0e3', dark: '#36343a' },
        ink: {
          DEFAULT: '#1d1b1f',
          soft: '#47464c',
          faint: '#5f5d64',
          dark: '#e6e1e6',
          softdark: '#cac5cd',
          faintdark: '#a9a4ac',
        },
        // DEFAULT is for fills and icons. Red words use `text`/`textdark`.
        // `soft` is the primary container (active nav, selected states) and
        // `on` the text that sits on it.
        brand: {
          DEFAULT: '#dc2626',
          hover: '#c81e1e',
          soft: '#fde8e7',
          softdark: '#3d1715',
          softhover: '#fbd8d6',
          softhoverdark: '#4b1d1a',
          text: '#b91c1c',
          textdark: '#ffb4ab',
          on: '#8a1212',
          ondark: '#ffdad6',
        },
        // Inverse surface: the snackbar.
        inverse: { DEFAULT: '#322f35', on: '#f5eff7', primary: '#ffb4ab', dark: '#e6e1e6', ondark: '#322f35' },
        focus: { DEFAULT: '#1d1b1f', dark: '#e6e1e6' },
        success: {
          DEFAULT: '#146c2e',
          hover: '#0f5524',
          soft: '#d7f0dd',
          softdark: '#12301b',
          softhover: '#c4e8cd',
          softhoverdark: '#183d23',
          text: '#146c2e',
          textdark: '#7fd99a',
        },
        warning: {
          DEFAULT: '#8f5f00',
          hover: '#7a5300',
          soft: '#fbebc6',
          softdark: '#2e2410',
          softhover: '#f7e0a8',
          softhoverdark: '#3b2e12',
          text: '#7a5300',
          textdark: '#f5c451',
        },
        info: {
          soft: '#dcecf7',
          softdark: '#14303f',
          text: '#0b5d8a',
          textdark: '#8ccdf2',
        },
        stage: {
          editing: '#6940a5',
          review: '#0b6e99',
          post: '#8a6100',
          posted: '#2f6e4a',
        },
      },
      borderRadius: {
        // Material 3 shape scale: 12px cards, 8px fields and filter chips,
        // 6px small tags, 28px dialogs. Buttons are pills (rounded-full).
        card: '12px',
        tile: '8px',
        chip: '6px',
        dialog: '28px',
      },
      boxShadow: {
        // Elevation only on things that float: menus, dialogs, the FAB, a card
        // in the hand. Static surfaces are told apart by fill, not by shadow.
        card: 'none',
        // A white card resting on a grey board lane: just enough to sit on it.
        rest: '0 1px 2px rgba(0,0,0,.06)',
        e1: '0 1px 2px rgba(0,0,0,.14), 0 1px 3px 1px rgba(0,0,0,.06)',
        lift: '0 4px 8px 3px rgba(0,0,0,.08), 0 1px 3px rgba(0,0,0,.16)',
        float: '0 1px 2px rgba(0,0,0,.14), 0 2px 6px 2px rgba(0,0,0,.08)',
        drag: '0 8px 12px 6px rgba(0,0,0,.10), 0 4px 4px rgba(0,0,0,.16)',
        pill: 'none',
      },
      // One curve for everything that moves: quick to start, soft to land.
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(.2,0,0,1)',
      },
      // No `to` frame on purpose: the browser fills it in from the element's
      // own opacity and transform, so an entrance ends wherever the element
      // rests instead of jumping to 1 and none.
      keyframes: {
        'fade-in': { from: { opacity: '0' } },
        'fade-up': { from: { opacity: '0', transform: 'translateY(6px)' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(.97)' } },
        'sheet-up': { from: { opacity: '0', transform: 'translateY(24px)' } },
      },
      // `backwards` holds the first frame through any delay, which is what lets
      // a staggered list item stay hidden until its turn, and lets go once it
      // has played, so an element's own hover and press transforms are never
      // overridden by a finished entrance.
      animation: {
        'fade-in': 'fade-in 160ms cubic-bezier(.2,0,0,1) backwards',
        'fade-up': 'fade-up 220ms cubic-bezier(.2,0,0,1) backwards',
        'scale-in': 'scale-in 180ms cubic-bezier(.2,0,0,1) backwards',
        'sheet-up': 'sheet-up 240ms cubic-bezier(.2,0,0,1) backwards',
      },
    },
  },
  plugins: [],
}
