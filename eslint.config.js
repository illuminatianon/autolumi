import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';

export default [

  // base config for everything
  {
    files: ['**/*.{js,mjs,jsx,vue}'],
    ignores: ['**/dist*/**', '**/coverage/**'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    plugins: {
      vue: pluginVue,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...pluginVue.configs['flat/recommended'].rules,
      'vue/multi-word-component-names': 'off',
      'vue/no-deep-combinator': 'off',
      'vue/valid-v-deep': ['error', { modifier: true }],
    },
  },

  // node-specific rules for server files
  {
    files: ['apps/server/**/*.{js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        require: 'readonly',
        module: 'readonly',
        process: 'readonly',
      },
    },
    env: {
      node: true,
    },
  },

];