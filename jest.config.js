/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'node',
      preset: 'jest-expo/node',
      testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
      testPathIgnorePatterns: ['\\.tsx$', '/components/'],
      modulePathIgnorePatterns: ['<rootDir>/supabase/functions/'],
      moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
    },
  ],
  collectCoverageFrom: ['utils/**/*.ts', 'lib/**/*.ts', '!**/*.d.ts'],
};
