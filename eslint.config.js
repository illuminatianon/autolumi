import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';

export default [
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,mjs,jsx,vue}'],
  },
  {
    name: 'server/files-to-lint',
    files: ['server/**/*.js'],
  },
  {
    name: 'app/files-to-ignore',
    ignores: ['**/dist/**', '**/dist-ssr/**', '**/coverage/**'],
  },

  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],

  {
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-deep-combinator': 'off', // Allow :deep selector
      'vue/valid-v-deep': ['error', { // Configure :deep usage
        modifier: true,
      }],
    },
    settings: {
      'css': {
        // Allow Vuetify CSS custom properties
        customProperties: {
          '--v-theme-': true,
        },
      },
    },
  },
  {
    'overrides': [
      {
        'files': ['server/**/*.js'],
        'env': {
          'node': true,
        },
      },
    ],
  },

];
