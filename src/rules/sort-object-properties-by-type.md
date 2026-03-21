# sort-object-properties-by-type

Enforces sorting of object properties based on their TypeScript type definitions.

💼 This rule is enabled in the ✅ `recommended` [config](https://github.com/nirtamir2/eslint-plugin-sort-destructure-keys-typescript/blob/main/src/config.ts).

🔧💡 This rule is automatically fixable by the [`--fix` CLI option](https://eslint.org/docs/latest/user-guide/command-line-interface#--fix) and manually fixable by [editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

## Rule Details

This rule ensures that object properties are declared in the order specified by their TypeScript type definition.

### Examples

#### 🙎‍♂️ Incorrect

```ts
const res: { a: string; b: string } = { b: "2", a: "1" };
```

#### 😎 Correct

```ts
const res: { a: string; b: string } = { a: "1", b: "2" };
```

### More Examples

#### Arrays of objects

```ts
const res: Array<{ a: string; b: string }> = [{ b: "2", a: "1" }];
```

✅ Fixed output:

```ts
const res: Array<{ a: string; b: string }> = [{ a: "1", b: "2" }];
```

#### Nested objects

```ts
const res: Array<{
  nested: { a: string; b: string };
}> = [{ nested: { b: "2", a: "1" } }];
```

✅ Fixed output:

```ts
const res: Array<{
  nested: { a: string; b: string };
}> = [{ nested: { a: "1", b: "2" } }];
```
