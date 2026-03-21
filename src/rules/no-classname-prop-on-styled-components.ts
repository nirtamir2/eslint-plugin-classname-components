import type { TSESTree } from "@typescript-eslint/types";
import type * as TSESLint from "@typescript-eslint/utils/ts-eslint";
import { createComponentAnalyzer } from "./component-analysis";
import { createEslintRule } from "../utils";

export const RULE_NAME = "no-classname-prop-on-styled-components";
export type MessageIds = "forbid" | "removeClassName";
export type Options = [];
const INTRINSIC_ELEMENT_NAME_REGEX = /^[a-z]/;

function getClassNameAttribute(
  attributes: Array<TSESTree.JSXAttribute | TSESTree.JSXSpreadAttribute>,
): TSESTree.JSXAttribute | undefined {
  return attributes.find((attribute): attribute is TSESTree.JSXAttribute => {
    return (
      attribute.type === "JSXAttribute" &&
      attribute.name.type === "JSXIdentifier" &&
      attribute.name.name === "className"
    );
  });
}

function isIntrinsicElementName(node: TSESTree.JSXOpeningElement["name"]): boolean {
  return (
    node.type === "JSXIdentifier" &&
    INTRINSIC_ELEMENT_NAME_REGEX.test(node.name)
  );
}

export default createEslintRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow passing className to components that already style themselves internally",
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      forbid:
        'Component "{{name}}" already owns its styling. Remove the external `className` prop and move that styling into a variant inside the component.',
      removeClassName:
        "Remove the external className prop and model that styling as a component variant instead.",
    },
  },
  defaultOptions: [],
  create: (context) => {
    const analyzer = createComponentAnalyzer(context);

    return {
      JSXOpeningElement(node) {
        if (isIntrinsicElementName(node.name)) {
          return;
        }

        const classNameAttribute = getClassNameAttribute(node.attributes);
        if (classNameAttribute == null) {
          return;
        }

        const analysis = analyzer.analyzeJsxOpeningElement(node);
        if (analysis == null || !analysis.hasInternalStyle) {
          return;
        }

        context.report({
          node: classNameAttribute,
          messageId: "forbid",
          data: {
            name: analysis.name,
          },
          suggest: [
            {
              messageId: "removeClassName",
              fix: (fixer: TSESLint.RuleFixer) => {
                const start =
                  context.sourceCode.text[classNameAttribute.range[0] - 1] === " "
                    ? classNameAttribute.range[0] - 1
                    : classNameAttribute.range[0];
                return fixer.removeRange([start, classNameAttribute.range[1]]);
              },
            },
          ],
        });
      },
    };
  },
});
