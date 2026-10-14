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
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // Notion register: pure white page, warm near-black ink, a single
        // off-white tint for sidebar and insets. Every text tier below clears
        // WCAG AA (4.5:1) on both `canvas` and `tint`, in both themes — see
        // src/color.test.ts, which asserts it.
        canvas: { DEFAULT: '#ffffff', dark: '#191919' },
        // `surface` is the same as canvas in this register: cards are defined
        // by a hairline, not by being a different colour. The name is kept so
        // existing components need no edit.
        surface: { DEFAULT: '#ffffff', dark: '#191919' },
        // Sidebar, insets, read-only prose blocks. `raised` is an alias kept
        // for the same reason as `surface`.
        tint: { DEFAULT: '#f7f7f5', dark: '#252525' },
        raised: { DEFAULT: '#f7f7f5', dark: '#252525' },
        hover: { DEFAULT: '#efefed', dark: '#2f2f2f' },
        hairline: { DEFAULT: '#eae9e5', dark: '#333333' },
        ink: {
          DEFAULT: '#37352f',
          soft: '#5c5b56',
          faint: '#71706b',
          dark: '#e9e9e7',
          softdark: '#a8a8a4',
          faintdark: '#8c8c88',
        },
        // DEFAULT is for fills and icons. Red words use `text`/`textdark`:
        // #dc2626 as text is under AA on brand-soft and on every dark surface.
        brand: {
          DEFAULT: '#dc2626',
          hover: '#b91c1c',
          soft: '#fdf2f2',
          softdark: '#2a1414',
          softhover: '#fbe4e4',
          softhoverdark: '#3a1a1a',
          text: '#b91c1c',
          textdark: '#f87171',
        },
        // Keyboard focus. The brand red in light; a lighter red in dark, where
        // the brand red is under the 3:1 a focus indicator needs.
        focus: { DEFAULT: '#dc2626', dark: '#f87171' },
        // Semantic tones, shaped like brand: DEFAULT/hover are fills under
        // white text, soft/softhover the tinted washes, text/textdark the words.
        // src/color.test.ts asserts every pair against AA.
        success: {
          DEFAULT: '#047857',
          hover: '#065f46',
          soft: '#ecfdf5',
          softdark: '#13271d',
          softhover: '#d1fae5',
          softhoverdark: '#1a3527',
          text: '#047857',
          textdark: '#34d399',
        },
        warning: {
          DEFAULT: '#b45309',
          hover: '#92400e',
          soft: '#fffbeb',
          softdark: '#2a2210',
          softhover: '#fef3c7',
          softhoverdark: '#3a2c10',
          text: '#92400e',
          textdark: '#fbbf24',
        },
        // A neutral role tint (the Social Media Manager chip). The Review
        // stage's pill pair, so the app keeps one blue.
        info: {
          soft: '#e7f3f8',
          softdark: '#15303d',
          text: '#0b6e99',
          textdark: '#77bddd',
        },
        // Stage text colours. The tint/text pairs used by the pills live in
        // STAGES in src/utils.ts, because they are applied as inline styles.
        stage: {
          editing: '#6940a5',
          review: '#0b6e99',
          post: '#8a6100',
          posted: '#2f6e4a',
        },
      },
      borderRadius: {
        // Softer than the Notion register's 4/6px, to sit with the pastel
        // cards: 12px for cards, panels and dialogs, 6px for controls, 4px for
        // the chips inside them.
        card: '12px',
        tile: '6px',
        chip: '4px',
      },
      boxShadow: {
        // Static surfaces are defined by a hairline, not a shadow. `shadow-card`
        // is deliberately flattened rather than removed so existing components
        // that reference it become flat instead of losing a class silently.
        card: 'none',
        lift: '0 4px 12px rgba(15,15,15,0.10), 0 1px 3px rgba(15,15,15,0.06)',
        // A card under the pointer: just enough to read as raised off the page.
        // Not named `hover`: a colour of that name exists, and shadow-hover
        // would then also set the shadow's colour to it.
        float: '0 6px 16px -4px rgba(15,15,15,0.12), 0 2px 4px rgba(15,15,15,0.05)',
        // A card in the hand, mid-drag.
        drag: '0 18px 36px -10px rgba(15,15,15,0.25), 0 4px 10px rgba(15,15,15,0.08)',
        pill: 'none',
      },
      // One curve for everything that moves: quick to start, soft to land.
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(.2,.8,.2,1)',
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
        'fade-in': 'fade-in 160ms cubic-bezier(.2,.8,.2,1) backwards',
        'fade-up': 'fade-up 220ms cubic-bezier(.2,.8,.2,1) backwards',
        'scale-in': 'scale-in 180ms cubic-bezier(.2,.8,.2,1) backwards',
        'sheet-up': 'sheet-up 240ms cubic-bezier(.2,.8,.2,1) backwards',
      },
    },
  },
  plugins: [],
}
