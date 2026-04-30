/*
 * Tailwind config — Dolomites trip, vintage alpine travel poster aesthetic.
 *
 * The new palette is exposed as utility classes (bg-bg, text-ink, bg-gold, etc.).
 * Legacy names (forest/sage/border/etc.) are aliased to the new tokens so pages
 * that haven't been migrated yet continue to render — they'll inherit the
 * vintage colors automatically until their layouts get the poster treatment.
 */
import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        // new vintage poster palette
        bg: '#F1E9D2',
        'bg-paper': '#EBE2C7',
        'bg-paper-2': '#E2D9B9',
        ink: '#0E3B43',
        'ink-soft': '#2C5359',
        gold: '#D4A24C',
        crevasse: '#3E6680',
        signal: '#A83232',
        moss: '#5C6E3E',
        hairline: 'rgba(14, 59, 67, 0.12)',

        // legacy aliases
        'bg-2': '#EBE2C7',
        surface: '#FBF7E8',
        'ink-muted': '#2C5359',
        forest: '#0E3B43',
        sage: '#3E6680',
        'sage-2': '#2C5359',
        border: 'rgba(14, 59, 67, 0.12)',
      },
      fontFamily: {
        display: ['Fraunces', 'Iowan Old Style', 'Georgia', 'serif'],
        sans: ['Inter Tight', 'ui-sans-serif', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.03em',
        'mono-cap': '0.12em',
      },
      boxShadow: {
        'paper-sm': '0 1px 2px rgba(14, 59, 67, 0.08), 0 0 0 1px rgba(14, 59, 67, 0.06)',
        'paper-md': '0 4px 10px rgba(14, 59, 67, 0.12), 0 1px 0 rgba(14, 59, 67, 0.06)',
        'paper-lg': '0 14px 28px rgba(14, 59, 67, 0.18), 0 2px 0 rgba(14, 59, 67, 0.10)',
        'stamp': '1px 2px 0 rgba(14, 59, 67, 0.18)',
      },
    },
  },
  plugins: [],
} satisfies Config;
