import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'tests/legacy/**', 'test-results/**', '*.js', '!src/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ClothSim: 'readonly' }, // ClothSim: physics.js, loaded as a classic script
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true, varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }], // storage may be blocked: those catches are deliberate
      // mutation we plan to remove with the pure core (step C): shown as warnings, not errors
      'no-param-reassign': [
        'warn',
        {
          props: true,
          ignorePropertyModificationsFor: [
            'g',
            'e',
            'el',
            'cv',
            'c',
            'm',
            'mesh',
            'head',
            'sel',
            'box',
            'img',
            'tex',
            'cam',
            'leg',
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.mjs', '*.config.mjs', 'tools/**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }], 'no-unused-vars': ['error', { caughtErrors: 'none' }] },
  },
];
