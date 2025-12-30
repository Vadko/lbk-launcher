module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'out', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['react-refresh', 'unused-imports'],
  rules: {
    // === React ===
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // === TypeScript ===
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'off', // Використовуємо unused-imports замість цього
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/no-empty-interface': 'warn',
    '@typescript-eslint/prefer-as-const': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn',
    '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],

    // === Unused imports/vars ===
    'unused-imports/no-unused-imports': 'warn',
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],

    // === Best Practices ===
    'no-console': 'off', // Дозволяємо console для Electron-застосунку
    'no-debugger': 'warn',
    'no-duplicate-imports': 'error',
    'no-template-curly-in-string': 'warn',
    'prefer-const': 'warn',
    'no-var': 'error',
    'eqeqeq': ['warn', 'always', { null: 'ignore' }],
    'no-return-await': 'warn',
    'require-await': 'warn',

    // === Code Style ===
    'arrow-body-style': ['warn', 'as-needed'],
    'object-shorthand': ['warn', 'always'],
    'prefer-arrow-callback': 'warn',
    'prefer-template': 'warn',
    'no-useless-concat': 'warn',
    'no-useless-rename': 'warn',
    'no-lonely-if': 'warn',
    'no-else-return': ['warn', { allowElseIf: false }],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
}
