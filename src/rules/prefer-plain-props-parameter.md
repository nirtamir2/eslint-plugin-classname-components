# prefer-plain-props-parameter

Prefer a plain `props` parameter over object destructuring that only does
`{ ...props }`.

## Why

`{ ...props }: Type` adds noise without changing the API shape in a meaningful
way. When the component only needs the full props object, a plain identifier
parameter is easier to read.

## Reported

```tsx
type Props = JSX.IntrinsicElements["button"];

function Button({ ...props }: Props) {
  return <button {...props} />;
}
```

## Allowed

```tsx
type Props = JSX.IntrinsicElements["button"];

function Button(props: Props) {
  return <button {...props} />;
}
```

## Autofix

- `({ ...props }: Props)` -> `(props: Props)`
- `({ ...props }: Props = fallbackProps)` -> `(props: Props = fallbackProps)`
