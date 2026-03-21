# Classname Styled Components Rule Design

## Goal

Replace the existing sorting-focused ESLint rules with a type-aware React component API plugin that enforces this styling contract:

- Styled custom components must not expose a `className` prop.
- Styled custom components must not be called with a `className` prop.
- If styling needs to vary, authors should model that with meaningful variant props instead of external `className` injection.

## Rule Set

### 1. `no-classname-prop-in-styled-components`

This rule runs on component definitions.

It reports when a React component has internal styling and still exposes `className` through its props surface.

Examples of what should be reported:

- A props interface or type includes `className?: string`.
- A component parameter destructures `className`.
- A component extends HTML props that include `className` without removing it.

Suggested fixes:

- Suggest changing the props type to `Omit<T, "className">` when the component inherits from a base prop type that includes `className`.
- Suggest replacing ad-hoc external styling with a meaningful variant prop.

This rule should not treat pure passthrough alone as internal styling. In particular:

- `className={props.className}` alone is not internal styling.
- `className={className}` alone is not internal styling.
- `{...props}` alone is not internal styling, even if `props` may include `className`.

This rule should treat the component as internally styled when it applies any internal styling signal to rendered JSX, including:

- `className="..."`
- ``className={`...`}``
- `className={clsx(...)}`
- `className={cva(...)}`
- `className={styles}`
- `className={buttonClassName}`

The rule should resolve local identifiers when practical so internal style constants are detected.

This rule should also treat merge patterns as internally styled, including:

- `className={clsx("base", className)}`
- `className={clsx(buttonClassName, props.className)}`

Recognized component forms for v1:

- function declarations
- function expressions assigned to variables
- arrow functions assigned to variables
- `forwardRef(...)`
- `memo(...)`
- `memo(forwardRef(...))`

### 2. `no-classname-prop-on-styled-components`

This rule runs on JSX call sites.

It reports when JSX passes `className` to a custom component that is internally styled according to the same detection logic as the definition rule.

Examples of what should be reported:

- `<Button className="mt-4" />` when `Button` applies internal styling
- `<Button {...props} className="mt-4" />` when `Button` applies internal styling

Behavior:

- Ignore lowercase intrinsic elements such as `<div />`.
- Skip components that cannot be resolved to local source reliably.
- Reuse the same "internally styled" analysis as the definition rule so both rules agree.

Suggested fixes:

- Suggest introducing a meaningful variant prop such as `variant`.
- Suggest moving the hardcoded external `className` value into a variant branch or `cva` variant definition inside the component.

## Internal Styling Detection

The plugin should use a shared analyzer so both rules classify components the same way.

The analyzer should:

1. Resolve a component declaration from either a definition node or a JSX tag.
2. Identify the rendered JSX returned by that component.
3. Inspect `className` attributes on rendered JSX elements.
4. Decide whether any `className` expression contains internal styling instead of pure passthrough.

Detection heuristics for v1:

- Literal strings count as internal styling.
- Template literals count as internal styling if they contain non-empty static content or styled local identifiers.
- Calls to `clsx(...)` count as internal styling when any argument is internal styling.
- Calls to `cva(...)` count as internal styling.
- Local identifiers count as internal styling when their initializer resolves to an internal styling expression.
- Pure passthrough values do not count on their own:
  - `className`
  - `props.className`
  - values sourced only from `{...props}` forwarding

## Options

V1 should ship with no rule options.

If needed later, options can be added for:

- extra styling helper names
- extra wrapper function names
- opt-in support for additional style systems

## Autofix Strategy

Neither rule should apply an automatic fix in v1 because the safe refactor depends on component semantics.

Both rules should provide actionable suggestions.

For `no-classname-prop-in-styled-components`:

- Suggest wrapping inherited props with `Omit<T, "className">`.
- Suggest removing `className` from local props definitions.

For `no-classname-prop-on-styled-components`:

- Suggest replacing `className` usage with a meaningful variant prop.
- Suggest moving the hardcoded class value into a `variant` branch or `cva` configuration inside the component.

## Repo Restructure

The existing rule layout should be preserved, but the current sorting rules should be removed.

Target structure:

- `src/plugin.ts`
- `src/config.ts`
- `src/index.ts`
- `src/types.ts`
- `src/utils.ts`
- `src/rules/no-classname-prop-in-styled-components.ts`
- `src/rules/no-classname-prop-in-styled-components.test.ts`
- `src/rules/no-classname-prop-on-styled-components.ts`
- `src/rules/no-classname-prop-on-styled-components.test.ts`
- shared internal helpers as needed under `src/rules/` or `src/`

Supporting docs and package metadata should be updated to match the new plugin purpose.

## Testing Plan

Tests should cover:

- components with inline string class names
- components using `clsx`
- components using `cva`
- components using local style constants
- passthrough-only components that should remain allowed
- inherited DOM props with and without `Omit<..., "className">`
- JSX call sites on styled components
- JSX call sites on unstyled passthrough components
- `forwardRef` and `memo` component forms
- unresolved or external components that should be skipped safely

## Out of Scope for V1

- automatic codemods that invent variant names
- deep analysis of external library source
- support for every styling system
- guarantees around spread prop contents beyond the explicit passthrough heuristic
