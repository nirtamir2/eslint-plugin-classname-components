import type { TSESTree } from "@typescript-eslint/types";
import { createComponentAnalyzer } from "./component-analysis";
import {
  buildClassNameAttributeText,
  getStaticClassNameReplacement,
} from "./render-classname-utils";
import { createEslintRule } from "../utils";

export const RULE_NAME = "prefer-static-classname-in-styled-components";
export type MessageIds = "preferStatic";
export type Options = [];

function isClassNameAttribute(
  node: TSESTree.JSXAttribute,
): node is TSESTree.JSXAttribute & {
  name: TSESTree.JSXIdentifier;
  value: TSESTree.JSXExpressionContainer & {
    expression: Exclude<
      TSESTree.JSXExpressionContainer["expression"],
      TSESTree.JSXEmptyExpression | null
    >;
  };
} {
  return (
    node.name.type === "JSXIdentifier" &&
    node.name.name === "className" &&
    node.value?.type === "JSXExpressionContainer" &&
    node.value.expression != null &&
    node.value.expression.type !== "JSXEmptyExpression"
  );
}

export default createEslintRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer plain JSX string literals for fully static className values in internally styled components",
    },
    fixable: "code",
    schema: [],
    messages: {
      preferStatic:
        "This className value is fully static. Replace it with a plain JSX string literal.",
    },
  },
  defaultOptions: [],
  create: (context) => {
    const analyzer = createComponentAnalyzer(context);

    return {
      JSXAttribute(node) {
        if (!isClassNameAttribute(node)) {
          return;
        }

        const analysis = analyzer.getEnclosingComponentAnalysis(node);
        if (analysis == null || !analysis.hasInternalStyle) {
          return;
        }

        const replacement = getStaticClassNameReplacement(
          node.value.expression,
        );
        if (replacement == null) {
          return;
        }

        context.report({
          node: node.value,
          messageId: "preferStatic",
          fix: (fixer) => {
            return fixer.replaceText(
              node,
              buildClassNameAttributeText(replacement),
            );
          },
        });
      },
    };
  },
});
