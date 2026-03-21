# no-classname-prop-on-styled-components

Disallow passing `className` to components that already style themselves
internally.

## Why

If a component owns its styling internally, consumers should use meaningful
variant props instead of overriding it with external `className` values.

## Reported

```tsx
function Button() {
  return <button className="rounded px-4" />;
}

<Button className="mt-4" />;
```

## Allowed

```tsx
type Props = JSX.IntrinsicElements["button"];

function Button(props: Props) {
  return <button className={props.className} />;
}

<Button className="mt-4" />;
```

## Suggestions

- Remove the external `className` prop
- Move the styling choice into a component variant such as `variant`

