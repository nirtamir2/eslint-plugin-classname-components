# Render Classname Rules Design

## Goal

Add two render-side ESLint rules for internally styled React components:

- normalize fully static `className` expressions to plain JSX string literals
- forbid merging prop-driven `className` values into internally styled components

These rules complement the existing API and call-site rules:

- `no-classname-prop-in-styled-components`
- `no-classname-prop-on-styled-components`

## Rule Set

### 1. `prefer-static-classname-in-styled-components`

This rule runs on rendered JSX `className` attributes inside internally styled
components.

It reports when the `className` value is semantically static but written in a
more complex form.

Reported examples:

- `className={"rounded"}`
- ``className={`rounded px-4`}``
- `className={clsx("rounded")}`
- `className={clsx("rounded", "px-4")}`
- `className={cn("rounded", "px-4")}`

Autofix behavior:

- rewrite to a plain JSX string literal when the final class list is fully
  static
- examples:
  - `className={"rounded"}` -> `className="rounded"`
  - `className={clsx("rounded", "px-4")}` -> `className="rounded px-4"`

This rule should not report genuinely dynamic expressions such as:

- `className={clsx("rounded", disabled && "opacity-50")}`
- `className={buttonVariants({ variant })}`
- `className={clsx("rounded", variant === "ghost" && "bg-transparent")}`

### 2. `no-classname-prop-merge-in-styled-components`

This rule runs on rendered JSX `className` attributes inside internally styled
components.

It reports when the rendered `className` expression includes a prop-originated
`className` value, because styling variation should be modeled through a
meaningful variant prop or similar internal styling API.

Reported examples:

- `className={className}`
- `className={props.className}`
- `className={clsx("rounded", className)}`
- `className={cn("rounded", "px-4", className)}`
- `className={clsx(buttonVariants({ variant }), className)}`

Autofix behavior:

- remove the prop-originated `className` input when the remaining expression is
  still valid and meaningful
- examples:
  - `className={clsx("rounded", className)}` -> `className="rounded"`
  - `className={clsx(buttonVariants({ variant }), className)}`
    -> `className={buttonVariants({ variant })}`
- do not autofix when the expression is pure passthrough and removal would leave
  no styling expression

## Shared Detection

Both rules should reuse the existing component analysis so they only target
components that already own internal styling.

The render-side normalization logic should additionally:

- treat `clsx` and `cn` as recognized class-merging helpers
- flatten nested static string segments where practical
- recognize prop-driven `className` values from:
  - destructured `className`
  - `props.className`
  - `props["className"]`
  - aliases that resolve to those values

## Fixing Boundaries

V1 fixes should stay narrow and deterministic:

- join static class tokens with a single space
- preserve dynamic expressions instead of trying to invent variants
- avoid autofixing expressions that depend on runtime truthiness or require
  semantic restructuring
- avoid converting arbitrary template expressions unless the entire expression is
  provably static

## Tests

Add coverage for:

- direct string-expression wrappers
- no-substitution template literals
- static `clsx` and `cn` merges
- prop-originated `className` passthrough and merges
- mixed expressions where only the prop merge should be removed
- cases that must stay valid because they are dynamic

## Documentation

Update:

- plugin registration
- exported config defaults
- README rule list and examples
- per-rule markdown docs
