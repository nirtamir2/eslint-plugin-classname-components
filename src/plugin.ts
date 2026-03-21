import type { ESLint } from "eslint";
import { name, version } from "../package.json";
import sortDestructureKeysByType from "./rules/sort-destructure-keys-by-type";
import sortJsxAttributesByType from "./rules/sort-jsx-attributes-by-type";
import sortObjectPropertiesByType from "./rules/sort-object-properties-by-type";

export const plugin = {
  meta: {
    name,
    version,
  },
  // @keep-sorted
  rules: {
    "sort-destructure-keys-by-type": sortDestructureKeysByType,
    "sort-jsx-attributes-by-type": sortJsxAttributesByType,
    "sort-object-properties-by-type": sortObjectPropertiesByType,
  },
} satisfies ESLint.Plugin;
