# prefer-static-classname-in-styled-components

Prefer plain JSX string literals for fully static `className` or `class` values
in internally styled components. `class` is treated the same as `className`
(SolidJS). Autofixes keep the original attribute name.

## Why

If a component's final class list is fully static, wrapping it in `{"..."}`
or `clsx(...)` adds noise without adding flexibility. If the class list is
being assembled with a template literal, prefer `clsx(...)` over string
interpolation so static segments and dynamic conditions stay explicit. Inside
`clsx(...)`, prefer `condition && "class"` over `condition ? "class" : ""`.

## Reported

```tsx
function Button() {
  return <button className={clsx("rounded", "px-4")} />;
}

function Button(props: { disabled?: boolean }) {
  return (
    <button className={`rounded px-4 ${props.disabled ? "opacity-50" : ""}`} />
  );
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
- `className={buttonClassName}` where `const buttonClassName = "rounded px-4"` ->
  `className="rounded px-4"`
- `className={clsx("rounded", "px-4")}` -> `className="rounded px-4"`
- `className={clsx("rounded", disabled ? "opacity-50" : "")}` ->
  `className={clsx("rounded", disabled && "opacity-50")}`
- ``className={`rounded px-4 ${disabled ? "opacity-50" : ""}`}`` ->
  `className={clsx("rounded px-4", disabled && "opacity-50")}`
