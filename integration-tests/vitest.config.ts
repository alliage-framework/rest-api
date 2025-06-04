import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  root: resolve(__dirname, '.'),
  test: {
    root: resolve(__dirname, '.'),
    include: ['**/*.test.ts'],
    environment: 'node',
    globals: true,
    typecheck: {
      tsconfig: resolve(__dirname, '../tsconfig.json'),
    },
  },
}); 