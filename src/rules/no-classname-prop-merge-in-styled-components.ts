import type { TSESTree } from "@typescript-eslint/types";
import { createComponentAnalyzer, isClassPropName } from "./component-analysis";
import {
  buildClassNameAttributeText,
  getClassNamePropMergeReplacement,
  hasClassNamePropMerge,
} from "./render-classname-utils";
import { createEslintRule } from "../utils";

export const RULE_NAME = "no-classname-prop-merge-in-styled-components";
export type MessageIds = "forbid";
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
    isClassPropName(node.name.name) &&
    node.value?.type === "JSXExpressionContainer" &&
    node.value.expression != null &&
    node.value.expression.type !== "JSXEmptyExpression"
  );
}

export default createEslintRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow merging prop-driven className or class values into internally styled components",
    },
    fixable: "code",
    schema: [],
    messages: {
      forbid:
        "This internally styled component should not merge prop-driven `{{prop}}` values. Move that styling into a variant or another internal styling API.",
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

        const isPropClassNameExpression = (expression: TSESTree.Expression) => {
          return analyzer.isClassNamePropExpression(expression, analysis);
        };

        if (
          !hasClassNamePropMerge(
            node.value.expression,
            isPropClassNameExpression,
          )
        ) {
          return;
        }

        const replacement = getClassNamePropMergeReplacement(
          node.value.expression,
          context.sourceCode,
          isPropClassNameExpression,
        );

        context.report({
          node: node.value,
          messageId: "forbid",
          data: {
            prop: node.name.name,
          },
          ...(replacement == null
            ? {}
            : {
                fix: (fixer) => {
                  return fixer.replaceText(
                    node,
                    buildClassNameAttributeText(replacement, node.name.name),
                  );
                },
              }),
        });
      },
    };
  },
});
