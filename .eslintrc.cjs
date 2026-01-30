module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
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
  plugins: ['react-refresh'],
  rules: {
    // === React ===
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // === Disable for TypeScript (tsc handles these) ===
    'no-unused-vars': 'off',
    'no-undef': 'off',

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
