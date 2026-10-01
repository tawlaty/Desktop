// ESLint 9 flat config for the Electron main/preload code (CommonJS, Node + Electron).
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['node_modules/**', 'production-exe/**', 'dist/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
    },
  },
  {
    // Runs in the renderer (browser globals) and is written as an ES module.
    files: ['electron/renderer/**/*.js'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.browser },
    },
  },
];
