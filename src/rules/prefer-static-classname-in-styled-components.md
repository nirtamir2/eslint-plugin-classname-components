# prefer-static-classname-in-styled-components

Prefer plain JSX string literals for fully static `className` values in
internally styled components.

## Why

If a component's final class list is fully static, wrapping it in `{"..."}`
or `clsx(...)` adds noise without adding flexibility.

## Reported

```tsx
function Button() {
  return <button className={clsx("rounded", "px-4")} />;
}
```

## Allowed

```tsx
function Button(props: { disabled?: boolean }) {
  return <button className={clsx("rounded", props.disabled && "opacity-50")} />;
}
```

## Autofix

- `className={"rounded px-4"}` -> `className="rounded px-4"`
- `className={clsx("rounded", "px-4")}` -> `className="rounded px-4"`
