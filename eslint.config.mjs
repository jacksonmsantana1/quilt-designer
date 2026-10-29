import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/node_modules/**',
      'app/dist/**',
      'app/coverage/**',
      'app/tests/legacy/**',
      'app/test-results/**',
      'app/*.js',
      'app/blender/**',
      'app/quilt_render_pkg/**',
      '*.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['app/src/**/*.js', 'shared/src/**/*.js'],
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
            'leg', 'dst', 'div',
          ],
        },
      ],
    },
  },
  {
    files: ['app/tests/**/*.mjs', 'shared/tests/**/*.mjs', '**/*.config.mjs', 'app/tools/**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }], 'no-unused-vars': ['error', { caughtErrors: 'none' }] },
  },
  // the server: Node only
  {
    files: ['server/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-param-reassign': ['error', { props: false }],
    },
  },
];
