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
        // Bento-grid surfaces: an off-white canvas with white cards lifted by
        // shadow. Replaces the old hard-bordered dark panels.
        canvas: { DEFAULT: '#f4f4f6', dark: '#0a0a0b' },
        surface: { DEFAULT: '#ffffff', dark: '#141416' },
        raised: { DEFAULT: '#fafafb', dark: '#1b1b1e' },
        hairline: { DEFAULT: '#ececef', dark: '#26262a' },
        ink: {
          DEFAULT: '#16161a',
          soft: '#5b5b66',
          faint: '#9a9aa6',
          dark: '#f5f5f7',
          softdark: '#a0a0ad',
          faintdark: '#5f5f6b',
        },
        brand: {
          DEFAULT: '#dc2626',
          hover: '#b91c1c',
          soft: '#fef2f2',
          softdark: '#2a1112',
        },
        // Workflow stages. `to-post` moved off red so red means brand and
        // genuine negatives only, rather than three things at once.
        //
        // Validated with the dataviz palette checker against a light surface:
        // lightness band, chroma floor, normal-vision separation and 3:1
        // contrast all pass. CVD separation lands in the 6-8 band, which is
        // permitted only alongside secondary encoding — every stage in this UI
        // is always accompanied by its text label, never colour alone.
        stage: {
          editing: '#8b5cf6',
          review: '#0284c7',
          post: '#d97706',
          posted: '#059669',
        },
      },
      borderRadius: {
        card: '18px',
        tile: '14px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,16,26,0.04), 0 4px 16px rgba(16,16,26,0.06)',
        lift: '0 2px 4px rgba(16,16,26,0.05), 0 12px 32px rgba(16,16,26,0.10)',
        pill: '0 1px 2px rgba(16,16,26,0.06)',
      },
    },
  },
  plugins: [],
}
