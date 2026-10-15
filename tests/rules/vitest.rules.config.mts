import { defineConfig } from 'vitest/config';

// Firestore security rules tests – run against the local emulator only:
//   npm run test:rules
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
