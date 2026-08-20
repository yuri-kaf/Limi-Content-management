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
        brand: {
          DEFAULT: '#dc2626',
          hover: '#b91c1c',
          soft: '#fdf2f2',
          softdark: '#2a1414',
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
        // Notion geometry: 4px for controls and cards, 6px for floating layers.
        // Replaces the previous 14/18px, which read as consumer-app rather than
        // document-tool.
        card: '6px',
        tile: '4px',
      },
      boxShadow: {
        // Static surfaces are defined by a hairline, not a shadow. `shadow-card`
        // is deliberately flattened rather than removed so existing components
        // that reference it become flat instead of losing a class silently.
        card: 'none',
        lift: '0 4px 12px rgba(15,15,15,0.10), 0 1px 3px rgba(15,15,15,0.06)',
        pill: 'none',
      },
    },
  },
  plugins: [],
}
