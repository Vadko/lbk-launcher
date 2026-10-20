import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

const noUnknownCast = {
  selector: "TSAsExpression > TSAsExpression[typeAnnotation.type='TSUnknownKeyword']",
  message: 'Parse untrusted values with a zod schema instead of `as unknown as`.',
};

const CYRILLIC = '/[А-Яа-яЁёҐґЄєІіЇї]/';
const noUkrainianLiterals = [
  `Literal[value=${CYRILLIC}]`,
  `TemplateElement[value.raw=${CYRILLIC}]`,
  `JSXText[value=${CYRILLIC}]`,
].map((selector) => ({
  selector,
  message: "Put user-visible text into packages/lbk-i18n/src/uk.ts and read it with t('…').",
}));

export default tseslint.config(
  {
    ignores: [
      'dist',
      'out',
      'release',
      'node_modules',
      'resources/extensions/**',
      '**/*.{js,cjs,mjs}',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'unused-imports': unusedImports,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // Rules newly introduced by ESLint 9 / tseslint v8 — disabled to preserve
      // pre-migration behavior. Address case-by-case in follow-up PRs.
      'preserve-caught-error': 'off',
      'no-useless-assignment': 'off',

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/prefer-as-const': 'warn',
      '@typescript-eslint/no-inferrable-types': 'warn',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],

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

      'no-restricted-globals': [
        'error',
        {
          name: 'localStorage',
          message:
            'Use electron-store via window.storeStorage instead of localStorage. See src/renderer/store/electronStorage.ts.',
        },
      ],

      'no-restricted-syntax': ['error', noUnknownCast, ...noUkrainianLiterals],

      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
      'no-console': 'off',
      'no-debugger': 'warn',
      'no-duplicate-imports': 'error',
      'no-template-curly-in-string': 'warn',
      'prefer-const': 'warn',
      'no-var': 'error',
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
      'no-return-await': 'warn',
      'require-await': 'warn',

      'arrow-body-style': ['warn', 'as-needed'],
      'object-shorthand': ['warn', 'always'],
      'prefer-arrow-callback': 'warn',
      'prefer-template': 'warn',
      'no-useless-concat': 'warn',
      'no-useless-rename': 'warn',
      'no-lonely-if': 'warn',
      'no-else-return': ['warn', { allowElseIf: false }],
    },
  },
  {
    files: ['src/main/liquid-glass.ts'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    // Supabase codegen output.
    files: ['src/lib/database.types.ts'],
    rules: { 'max-lines': 'off' },
  },
  {
    // Tests assert the rendered text, and these sources match Ukrainian catalog data rather than show it.
    files: [
      '**/*.test.ts',
      '**/*.fixture.ts',
      'e2e/**',
      'packages/lbk-i18n/src/uk.ts',
      'src/main/game-detector/game-titles.ts',
      'src/renderer/constants/specialTranslators.ts',
    ],
    rules: {
      'no-restricted-syntax': ['error', noUnknownCast],
    },
  },
  {
    // The whole Ukrainian dictionary stays in one file so a key is found in one place.
    files: ['packages/lbk-i18n/src/uk.ts'],
    rules: { 'max-lines': 'off' },
  },
  {
    // Decky imports the bundle once; there is no fast refresh to keep working.
    files: ['packages/lbk-bridge-decky/src/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // LBK sends the whole ops bundle (ops-cdp.ts and everything it imports) with every CDP call.
    files: [
      'packages/lbk-bridge-core/src/ops*.ts',
      'packages/lbk-bridge-core/src/steam-globals.ts',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@mobily/ts-belt',
              allowImportNames: ['G'],
              allowTypeImports: true,
              message: 'esbuild bundles a whole ts-belt namespace: G costs 2 KB, A 45 KB.',
            },
          ],
          patterns: [
            {
              regex: '^(?!\\./|@mobily/ts-belt$)',
              allowTypeImports: true,
              message:
                'The CDP ops bundle may only import sibling modules and G from ts-belt (no zod).',
            },
          ],
        },
      ],
    },
  },
  {
    // Steam web pages run the achievement page bundle (achievement-page-entry.ts and everything it imports).
    files: [
      'packages/lbk-bridge-core/src/achievement-page*.ts',
      'packages/lbk-bridge-core/src/achievement-query-cache.ts',
      'packages/lbk-bridge-core/src/achievement-text-memory.ts',
    ],
    ignores: ['**/*.test.ts', '**/*.fixture.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@mobily/ts-belt',
              allowImportNames: ['G'],
              allowTypeImports: true,
              message: 'esbuild bundles a whole ts-belt namespace: G costs 2 KB, A 45 KB.',
            },
          ],
          patterns: [
            {
              regex: '^(?!\\./|@mobily/ts-belt$|p-wait-for$)',
              allowTypeImports: true,
              message:
                'The achievement page bundle may only import sibling modules, G from ts-belt and p-wait-for (no zod).',
            },
          ],
        },
      ],
    },
  },
  {
    // Millennium injects webkit.js into every Steam web page; it gets public achievement strings and nothing that reaches LBK.
    files: [
      'packages/lbk-bridge-millennium/webkit/**',
      'packages/lbk-bridge-millennium/shared/**',
    ],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.\\./shared/|@lbk/bridge-core/achievement-page|@mobily/ts-belt$)',
              allowTypeImports: true,
              message:
                'webkit.js may only import the achievement page modules of the core, ts-belt and ../shared (no zod, no bridge).',
            },
          ],
        },
      ],
    },
  },
);
