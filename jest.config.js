/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    // Mock the supabaseClient since it uses import.meta.env
    './supabaseClient': '<rootDir>/src/services/__mocks__/supabaseClient.js',
  },
};

export default config;
