// Mock for astro:content used in vitest
// Provides z (re-exported from zod) and defineCollection stub
export { z } from 'zod';

export function defineCollection(config: unknown) {
  return config;
}
