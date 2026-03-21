# sort-jsx-attributes-by-type

JSX attributes should be sorted by the matching TypeScript type properties order.

💼 This rule is enabled in the ✅ `recommended` [config](https://github.com/nirtamir2/eslint-plugin-sort-destructure-keys-typescript/blob/main/src/config.ts).

🔧💡 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix) and manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

![demo-sort-jsx-attributes-by-type.gif](docs/demo-sort-jsx-attributes-by-type.gif)

## Rule Details

<!-- eslint-skip -->

```tsx
type Props = {
  name: string;
  email: string;
};

export function Example(props: Props) {
  return <div />;
}

// 👎 bad
<Example email="email" name="name" />;
```

<!-- eslint-skip -->

```tsx
type Props = {
  name: string;
  email: string;
};

export function Example(props: Props) {
  return <div />;
}

// 👍 good
<Example name="name" email="email" />;
```

## Options

Type: `object`

### `includeJSXLowercaseTags`

Type: `boolean`

Include JSX tags that start with a lowercase letter like native HTML elements. If set to `true` it may conflict with other ESLint plugins. Does not applicable if `componentNameRegex` is set.

Default: `{includeJSXLowercaseTags: false}`

#### Pass

```tsx
// sort-destructure-keys-typescript/sort-jsx-attributes-by-type: ["error", {includeJSXLowercaseTags: true}]}]

/// <reference types="react" />
/// <reference types="react-dom" />

// 👍 good - key is declared in React JSX before classNames
<div key="key" className="border" />
```

```tsx
// sort-destructure-keys-typescript/sort-jsx-attributes-by-type: ["error", {includeJSXLowercaseTags: false}]}]

/// <reference types="react" />
/// <reference types="react-dom" />

// 👍 good - we don't include native HTML elements so the order does not natter here
<div className="border" key="key" />;
<div key="key" className="border" />;
```

#### Fail

<!-- eslint-skip -->

```tsx
// sort-destructure-keys-typescript/sort-jsx-attributes-by-type: ["error", {includeJSXLowercaseTags: true}]}]

/// <reference types="react" />
/// <reference types="react-dom" />

// 👍 bad - key is declared in React JSX before classNames
<div className="border" key="key" />
```

<!-- eslint-skip -->

### componentNameRegex

Type: `string`

Pass `{componentNameRegex: "ComponentA|ComponentB"}` to lint-only components that their name match the regex

Pass `{componentNameRegex: "^(?!ExcludeComponent$|ExcludeComponent2$)[A-Z].*$"}`
to exclude native HTML components and exclude components named `ExcludeComponent` or `ExcludeComponent2`

Pass `{componentNameRegex: "^(?!ExcludeComponent$|ExcludeComponent2$).*$"}`
to include native HTML components and exclude components named `ExcludeComponent` or `ExcludeComponent2`

If `includeJSXLowercaseTags` is set to `true`, the default is to match all components with `^.*$`,
else the default is to match only components that start with uppercase letter `^[A-Z].*$`.

#### Pass

```tsx
// sort-destructure-keys-typescript/sort-jsx-attributes-by-type: ["error", {componentNameRegex: "^(?!ExcludeComponent$|ExcludeComponent2$)[A-Z].*$"}]

type Props = {
  name: string;
  email: string;
};

export function ExcludeComponent(props: Props) {
  return <div />;
}

// 👍 good - this component is excluded from the rule
<ExcludeComponent email="email" name="name" />;
<ExcludeComponent name="name" email="email" />;
```

#### Fail

<!-- eslint-skip -->

```tsx
// sort-destructure-keys-typescript/sort-jsx-attributes-by-type: ["error", {componentNameRegex: "^[A-Z].*$"}]
type Props = {
  name: string;
  email: string;
};

export function Example(props: Props) {
  const { email, name } = props;
}

// 👎 bad - name should be before email
<Example email="email" name="name" />;
```

<!-- eslint-skip -->
