import type { TSESTree } from "@typescript-eslint/types";
import type * as TSESLint from "@typescript-eslint/utils/ts-eslint";
import { createComponentAnalyzer } from "./component-analysis";
import { createEslintRule } from "../utils";

export const RULE_NAME = "no-classname-prop-in-styled-components";
export type MessageIds = "forbid" | "suggestOmit";
export type Options = [];
const OMIT_CLASSNAME_REGEX = /^Omit<.*,\s*"className"\s*>$/s;

function getTypeAnnotation(
  parameter: TSESTree.Parameter,
): TSESTree.TSTypeAnnotation | undefined {
  if (parameter.type === "Identifier" || parameter.type === "ObjectPattern") {
    return parameter.typeAnnotation ?? undefined;
  }

  if (parameter.type === "AssignmentPattern") {
    return getTypeAnnotation(parameter.left);
  }

  if (parameter.type === "RestElement") {
    return parameter.typeAnnotation ?? undefined;
  }

  return undefined;
}

export default createEslintRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow exposing className props from components that already style themselves internally",
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      forbid:
        'Styled component "{{name}}" should not expose a `className` prop. Remove it from the component API and model styling differences with variant props instead.',
      suggestOmit: 'Wrap the component props type in `Omit<T, "className">`.',
    },
  },
  defaultOptions: [],
  create: (context) => {
    const analyzer = createComponentAnalyzer(context);
    const reported = new Set<string>();

    function report(node: TSESTree.Node) {
      const analysis = analyzer.getCurrentFileAnalysis(node);
      if (analysis == null || !analysis.hasInternalStyle || !analysis.exposesClassNameProp) {
        return;
      }

      const reportKey = `${analysis.declaration.getSourceFile().fileName}:${analysis.declaration.pos}`;
      if (reported.has(reportKey)) {
        return;
      }
      reported.add(reportKey);

      const reportNode =
        (analysis.propsParameter == null
          ? undefined
          : analyzer.services.tsNodeToESTreeNodeMap.get(analysis.propsParameter)) ?? node;

      const suggestions = [];
      if (analysis.propsParameter != null) {
        const estreeParameter = analyzer.services.tsNodeToESTreeNodeMap.get(
          analysis.propsParameter,
        ) as TSESTree.Parameter | undefined;
        const typeAnnotation =
          estreeParameter == null ? undefined : getTypeAnnotation(estreeParameter);

        if (typeAnnotation != null) {
          const typeText = context.sourceCode.getText(typeAnnotation.typeAnnotation);
          if (!OMIT_CLASSNAME_REGEX.test(typeText)) {
            suggestions.push({
              messageId: "suggestOmit" as const,
              fix: (fixer: TSESLint.RuleFixer) => {
                return fixer.replaceText(
                  typeAnnotation.typeAnnotation,
                  `Omit<${typeText}, "className">`,
                );
              },
            });
          }
        }
      }

      context.report({
        node: reportNode,
        messageId: "forbid",
        data: {
          name: analysis.name,
        },
        ...(suggestions.length > 0 ? { suggest: suggestions } : {}),
      });
    }

    return {
      FunctionDeclaration: report,
      VariableDeclarator: report,
    };
  },
});
