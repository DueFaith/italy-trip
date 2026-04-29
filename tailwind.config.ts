import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{astro,html,js,ts,jsx,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#fbfaf6',
        'bg-2': '#f0ede2',
        surface: '#ffffff',
        ink: '#1f2937',
        'ink-muted': '#6b6258',
        forest: '#2d4a3e',
        sage: '#5a6b4d',
        'sage-2': '#6b7e5c',
        border: '#e6e1d2',
      },
      fontFamily: {
        sans: ['-apple-system', 'system-ui', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
