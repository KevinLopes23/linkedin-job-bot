// ESLint do Vagalume. As ferramentas ficam em tools/lint (TypeScript 6 próprio): o typescript-eslint
// ainda não roda com o TypeScript 7 do app, que não tem mais a API JS antiga.
import { createRequire } from 'node:module'

const require = createRequire(new URL('./tools/lint/package.json', import.meta.url))
const js = require('@eslint/js')
const tseslint = require('typescript-eslint')
const reactHooks = require('eslint-plugin-react-hooks')
const globals = require('globals')

export default [
  { ignores: ['out/**', 'release/**', 'tools/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
    languageOptions: { globals: globals.browser }
  },
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts', 'src/shared/**/*.ts', '*.{ts,mts,mjs}', 'build/**/*.mjs'],
    languageOptions: { globals: globals.node }
  }
]
