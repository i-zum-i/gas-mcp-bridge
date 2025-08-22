// @ts-check

const tseslint = require('typescript-eslint');
const prettierConfig = require('eslint-config-prettier');

module.exports = tseslint.config({
  files: ['**/*.ts'],
  extends: [
    ...tseslint.configs.recommended,
    prettierConfig,
  ],
});
