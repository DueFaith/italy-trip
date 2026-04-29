import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'astro:content': resolve(__dirname, 'tests/__mocks__/astro-content.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.{ts,mjs}'],
  },
});
