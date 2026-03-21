# no-classname-prop-merge-in-styled-components

Disallow merging prop-driven `className` values into internally styled
components.

## Why

If a component already owns its styling, merging a consumer-provided
`className` into its rendered output bypasses meaningful variants and makes the
API harder to reason about.

## Reported

```tsx
function Button({ className }: { className?: string }) {
  return <button className={clsx("rounded", className)} />;
}
```

## Allowed

```tsx
const buttonVariants = cva("rounded");

function Button(props: { variant?: "primary" | "secondary" }) {
  return <button className={buttonVariants({ variant: props.variant })} />;
}
```

## Autofix

- Remove merged prop-driven `className` inputs when the remaining expression is
  still valid
- Prefer variant props or `cva` branches for styling differences
