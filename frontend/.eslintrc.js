module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
        project: './tsconfig.json',
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript',
        'prettier',
    ],
    plugins: ['@typescript-eslint', 'import', 'prettier'],
    rules: {
        // TypeScript specific rules
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': 'off',
         '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        // Import rules
        'import/order': [
            'error',
            {
                'groups': ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
                'newlines-between': 'always',
                'alphabetize': { order: 'asc', caseInsensitive: true }
            }
        ],

        // General rules
        'no-console': 'off',
        'prettier/prettier': 'error',
    },
    settings: {
        'import/resolver': {
            node: {
                extensions: ['.js', '.jsx', '.ts', '.tsx'],
            },
        },
    },
    ignorePatterns: ['node_modules/', 'cdk.out/', 'build/', '**/*.js'],
};
