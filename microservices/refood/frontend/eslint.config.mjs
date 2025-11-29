import expo from 'eslint-config-expo/flat.js';

export default [
  ...expo,
  {
    ignores: ['dist/**'],
    rules: {
      'react/no-unescaped-entities': 'off',
    },
  },
];
