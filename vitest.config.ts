import {defineConfig} from 'vitest/config'

export default defineConfig({
  test: {
    include: ['__tests__/**/*.test.ts'],
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts'],
      thresholds: {branches: 60, functions: 60, lines: 70, statements: 70}
    }
  }
})
