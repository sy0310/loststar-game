import { defineConfig } from 'vitest/config';
export default defineConfig({
  server: { host: '127.0.0.1' },
  test: { include: ['tests/*.test.ts'], coverage: { provider: 'v8', include: ['src/game/**'], thresholds: { lines: 80, functions: 80, statements: 80, branches: 80 } } },
});
