module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
    extraFileExtensions: null,
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  rules: {
    '@typescript-eslint/ban-ts-ignore': 'off',
    // Don't require return types on methods/functions
    '@typescript-eslint/explicit-function-return-type': 'off',
    // Don't prevent us from typing as `any` (for now)
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // Prevent `await`ing on non-Thenable values
    '@typescript-eslint/await-thenable': 'error',
    // Prevent using unresolved promises in `if` statements or void functions
    '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
    // Require promise-like statements to be explicitly handled
    '@typescript-eslint/no-floating-promises': ['error', { ignoreIIFE: true }],
    'prettier/prettier': ['error', {}, { usePrettierrc: true }],
  },
  reportUnusedDisableDirectives: true,
};
