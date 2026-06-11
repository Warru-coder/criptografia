const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.js'] },
  js.configs.recommended,
  ...tsPlugin.configs['flat/recommended-type-checked'],
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      camelcase: 'error',
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      // Express handlers consume untyped req.body/req.query throughout; typing
      // them end-to-end is tracked for phase 3, not enforced retroactively.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  {
    // The CLI prints to stdout by design
    files: ['src/cli/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
