import type { ESLint } from "eslint";
import { name, version } from "../package.json";
import noClassnamePropInStyledComponents from "./rules/no-classname-prop-in-styled-components";
import noClassnamePropOnStyledComponents from "./rules/no-classname-prop-on-styled-components";

export const plugin = {
  meta: {
    name,
    version,
  },
  // @keep-sorted
  rules: {
    "no-classname-prop-in-styled-components":
      noClassnamePropInStyledComponents,
    "no-classname-prop-on-styled-components": noClassnamePropOnStyledComponents,
  },
} satisfies ESLint.Plugin;
