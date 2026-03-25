# no-classname-prop-in-styled-components

Disallow exposing `className` from components that already style themselves
internally.

## Why

If a component already owns base styling, external `className` injection makes
the API harder to reason about and bypasses meaningful component variants.

## Reported

```tsx
type Props = JSX.IntrinsicElements["button"];

function Button(props: Props) {
  return <button className="rounded px-4" />;
}
```

## Allowed

```tsx
type Props = JSX.IntrinsicElements["button"];

function Button(props: Props) {
  return <button className={props.className} />;
}
```

## Suggestions

- Wrap inherited prop types with `Omit<T, "className">`
- Replace external styling needs with variant props such as `variant` or `tone`

## Autofix

- Automatically wraps typed props in `Omit<T, "className">` when the
  component no longer references the `className` prop in its render logic
- For destructured params, also removes the `className` binding when it is safe
