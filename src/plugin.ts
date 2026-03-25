import type { ESLint } from "eslint";
import { name, version } from "../package.json";
import noClassnamePropMergeInStyledComponents from "./rules/no-classname-prop-merge-in-styled-components";
import noClassnamePropInStyledComponents from "./rules/no-classname-prop-in-styled-components";
import preferStaticClassnameInStyledComponents from "./rules/prefer-static-classname-in-styled-components";

export const plugin = {
  meta: {
    name,
    version,
  },
  // @keep-sorted
  rules: {
    "no-classname-prop-merge-in-styled-components":
      noClassnamePropMergeInStyledComponents,
    "no-classname-prop-in-styled-components": noClassnamePropInStyledComponents,
    "prefer-static-classname-in-styled-components":
      preferStaticClassnameInStyledComponents,
  },
} satisfies ESLint.Plugin;
