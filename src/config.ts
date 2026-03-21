import type { Linter } from "eslint";
import { name } from "../package.json";
import { plugin } from "./plugin";

export default function config(
  options: { strict?: boolean } = {},
): Linter.Config {
  const ruleSeverity: Linter.RuleSeverity = options.strict ? "error" : "warn";
  return {
    name,
    plugins: {
      [name]: plugin,
    },
    rules: {
      [`${name}/sort-destructure-keys-by-type`]: ruleSeverity,
      [`${name}/sort-jsx-attributes-by-type`]: ruleSeverity,
      [`${name}/sort-object-properties-by-type`]: ruleSeverity,
    },
  };
}
