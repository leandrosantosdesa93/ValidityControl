// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  ignorePatterns: ['/dist/*'],
  settings: {
    'import/resolver': {
      typescript: {
        project: ['./tsconfig.json', './app-example/tsconfig.json']
      },
      node: {
        paths: ['src', 'app-example'],
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      }
    }
  },
  rules: {
    'import/no-unresolved': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
  }
};
