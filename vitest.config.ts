import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['projects/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**']
  }
});
