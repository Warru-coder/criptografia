import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/cli/**',
        'src/web/server.ts',
        'src/backgroundTasks/**',
        'src/web/routes/webauthnRoutes.ts',
        'src/web/routes/aiRoutes.ts',
        'src/web/routes/apiRoutes.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 55,
        branches: 60,
        statements: 60,
      },
    },
  },
});
