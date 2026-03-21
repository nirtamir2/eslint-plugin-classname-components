# eslint-plugin-classname-components

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]

ESLint rules for React components that forbid exposing or passing `className`
on internally styled components.

The plugin is built for teams that want this contract:

- styled components should not expose `className`
- styled components should not accept `className` at the JSX call site
- styling differences should be expressed through meaningful variant props instead

The rules require TypeScript parser services. Configure
`@typescript-eslint/parser` with `parserOptions.project`.

Note: the npm package/import path stays lowercase as
`eslint-plugin-classname-components` because npm package names cannot contain
uppercase letters.

## Rules

- `no-classname-prop-in-styled-components`
  Flags component definitions that style themselves internally and still expose a
  `className` prop.
- `no-classname-prop-on-styled-components`
  Flags JSX usages that pass `className` to internally styled components.

## Configuration

```shell
pnpm add -D eslint-plugin-classname-components @typescript-eslint/parser typescript
```

Add to your `eslint.config.js`

```js
import typescriptEslintParser from "@typescript-eslint/parser";
import classnameComponentsConfig from "eslint-plugin-classname-components/config";

export default [
  // other settings...
  {
    // set up typescript-eslint
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  classnameComponentsConfig({ strict: true }),
];
```

## What Counts As Internal Styling

The rules treat a component as internally styled when it renders `className`
values derived from internal style signals such as:

- string or template literal class names
- `clsx(...)`
- `cva(...)`
- local identifiers that resolve to those style expressions
- merge patterns like `clsx("base", className)`

Pure passthrough alone does not count as internal styling:

- `className={props.className}`
- `className={className}`
- `{...props}` by itself

## Recommendations

When a component needs styling choices, prefer variant props such as `variant`,
`size`, or `tone` over external `className` injection.

## License

[MIT](./LICENSE) License © 2024-PRESENT [Nir Tamir](https://github.com/nirtamir2)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/eslint-plugin-classname-components?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/eslint-plugin-classname-components
[npm-downloads-src]: https://img.shields.io/npm/dm/eslint-plugin-classname-components?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/eslint-plugin-classname-components

### Thanks

- https://github.com/antfu/eslint-plugin-antfu for a starter project
- https://github.com/antfu/eslint-plugin-command for a starter project
- https://github.com/JoshuaKGoldberg/eslint-plugin-package-json for a starter project
