// @ts-check

import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config({
  files: ['**/*.ts'],
  extends: [
    ...tseslint.configs.recommended,
    prettierConfig,
  ],
});
