import type { TSESTree } from "@typescript-eslint/types";
import type * as TSESLint from "@typescript-eslint/utils/ts-eslint";
import { createComponentAnalyzer } from "./component-analysis";
import { createEslintRule } from "../utils";

export const RULE_NAME = "prefer-plain-props-parameter";
export type MessageIds = "preferPlainProps";
export type Options = [];

function getTypeAnnotation(
  parameter: TSESTree.Parameter,
): TSESTree.TSTypeAnnotation | undefined {
  if (parameter.type === "Identifier" || parameter.type === "ObjectPattern") {
    return parameter.typeAnnotation ?? undefined;
  }

  if (parameter.type === "AssignmentPattern") {
    return getTypeAnnotation(parameter.left);
  }

  return undefined;
}

function getRestOnlyParameterInfo(parameter: TSESTree.Parameter):
  | {
      restName: string;
      right: TSESTree.Expression | undefined;
    }
  | undefined {
  if (
    parameter.type === "ObjectPattern" &&
    parameter.properties.length === 1 &&
    parameter.properties[0]?.type === "RestElement" &&
    parameter.properties[0].argument.type === "Identifier"
  ) {
    return {
      restName: parameter.properties[0].argument.name,
      right: undefined,
    };
  }

  if (
    parameter.type === "AssignmentPattern" &&
    parameter.left.type === "ObjectPattern" &&
    parameter.left.properties.length === 1 &&
    parameter.left.properties[0]?.type === "RestElement" &&
    parameter.left.properties[0].argument.type === "Identifier"
  ) {
    return {
      restName: parameter.left.properties[0].argument.name,
      right: parameter.right,
    };
  }

  return undefined;
}

function buildReplacementText(
  parameter: TSESTree.Parameter,
  sourceCode: Readonly<TSESLint.SourceCode>,
): string | undefined {
  const info = getRestOnlyParameterInfo(parameter);
  const typeAnnotation = getTypeAnnotation(parameter);
  if (info == null || typeAnnotation == null) {
    return undefined;
  }

  const typeText = sourceCode.getText(typeAnnotation.typeAnnotation);
  return info.right == null
    ? `${info.restName}: ${typeText}`
    : `${info.restName}: ${typeText} = ${sourceCode.getText(info.right)}`;
}

export default createEslintRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer plain props parameters over useless rest-only object destructuring in React components",
    },
    fixable: "code",
    schema: [],
    messages: {
      preferPlainProps:
        "Prefer a plain `props` parameter when the component only destructures `{ ...props }`.",
    },
  },
  defaultOptions: [],
  create: (context) => {
    const analyzer = createComponentAnalyzer(context);

    function report(node: TSESTree.Node) {
      const analysis = analyzer.getCurrentFileAnalysis(node);
      const parameter =
        analysis?.propsParameter == null
          ? undefined
          : (analyzer.services.tsNodeToESTreeNodeMap.get(
              analysis.propsParameter,
            ) as TSESTree.Parameter | undefined);
      const replacementText =
        parameter == null
          ? undefined
          : buildReplacementText(parameter, context.sourceCode);

      if (analysis == null || parameter == null || replacementText == null) {
        return;
      }

      context.report({
        node: parameter,
        messageId: "preferPlainProps",
        fix: (fixer) => {
          return fixer.replaceText(parameter, replacementText);
        },
      });
    }

    return {
      FunctionDeclaration: report,
      VariableDeclarator: report,
    };
  },
});
