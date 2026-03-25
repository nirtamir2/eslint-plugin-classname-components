import type { TSESTree } from "@typescript-eslint/types";
import type * as TSESLint from "@typescript-eslint/utils/ts-eslint";
import type { ComponentAnalysis } from "./component-analysis";
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

function getObjectPatternTarget(
  parameter: TSESTree.Parameter,
): TSESTree.ObjectPattern | undefined {
  if (parameter.type === "ObjectPattern") {
    return parameter;
  }

  if (
    parameter.type === "AssignmentPattern" &&
    parameter.left.type === "ObjectPattern"
  ) {
    return parameter.left;
  }

  return undefined;
}

function getPropertyNameText(
  name: TSESTree.BindingName | TSESTree.PropertyName,
): string | undefined {
  if (name.type === "Identifier") {
    return name.name;
  }

  if (name.type === "Literal" && typeof name.value === "string") {
    return name.value;
  }

  return undefined;
}

function buildObjectPatternWithoutClassName(
  pattern: TSESTree.ObjectPattern,
  sourceCode: Readonly<TSESLint.SourceCode>,
): string | undefined {
  const remainingProperties = pattern.properties.filter((property) => {
    if (property.type === "RestElement") {
      return true;
    }

    const propertyName = getPropertyNameText(property.key);
    return propertyName !== "className";
  });

  if (remainingProperties.length === pattern.properties.length) {
    return undefined;
  }

  return remainingProperties.length === 0
    ? "{}"
    : `{ ${remainingProperties
        .map((property) => sourceCode.getText(property))
        .join(", ")} }`;
}

function buildParameterReplacementText(
  parameter: TSESTree.Parameter,
  typeText: string,
  sourceCode: Readonly<TSESLint.SourceCode>,
): string | undefined {
  const objectPattern = getObjectPatternTarget(parameter);
  if (objectPattern == null) {
    return undefined;
  }

  const patternText = buildObjectPatternWithoutClassName(
    objectPattern,
    sourceCode,
  );
  if (patternText == null) {
    return undefined;
  }

  const omittedTypeText = `Omit<${typeText}, "className">`;
  if (parameter.type === "AssignmentPattern") {
    return `${patternText}: ${omittedTypeText} = ${sourceCode.getText(parameter.right)}`;
  }

  return `${patternText}: ${omittedTypeText}`;
}

function hasClassNamePropUsage(
  node: TSESTree.Node,
  sourceCode: Readonly<TSESLint.SourceCode>,
  analyzer: ReturnType<typeof createComponentAnalyzer>,
  analysis: ComponentAnalysis,
): boolean {
  if (
    analyzer.services.esTreeNodeToTSNodeMap.has(node) &&
    analyzer.isClassNamePropExpression(node as TSESTree.Expression, analysis)
  ) {
    return true;
  }

  for (const key of sourceCode.visitorKeys[node.type] ?? []) {
    const value = node[key as keyof TSESTree.Node];
    if (value == null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (
          item != null &&
          typeof item === "object" &&
          "type" in item &&
          hasClassNamePropUsage(
            item as TSESTree.Node,
            sourceCode,
            analyzer,
            analysis,
          )
        ) {
          return true;
        }
      }
      continue;
    }

    if (
      typeof value === "object" &&
      "type" in value &&
      hasClassNamePropUsage(
        value as TSESTree.Node,
        sourceCode,
        analyzer,
        analysis,
      )
    ) {
      return true;
    }
  }

  return false;
}

export default createEslintRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow exposing className props from components that already style themselves internally",
    },
    fixable: "code",
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
      if (
        analysis == null ||
        !analysis.hasInternalStyle ||
        !analysis.exposesClassNameProp
      ) {
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
          : analyzer.services.tsNodeToESTreeNodeMap.get(
              analysis.propsParameter,
            )) ?? node;

      const suggestions = [];
      let autofix:
        | ((fixer: TSESLint.RuleFixer) => ReadonlyArray<TSESLint.RuleFix>)
        | undefined;
      if (analysis.propsParameter != null) {
        const estreeParameter = analyzer.services.tsNodeToESTreeNodeMap.get(
          analysis.propsParameter,
        ) as TSESTree.Parameter | undefined;
        const typeAnnotation =
          estreeParameter == null
            ? undefined
            : getTypeAnnotation(estreeParameter);

        if (typeAnnotation != null) {
          const typeText = context.sourceCode.getText(
            typeAnnotation.typeAnnotation,
          );
          if (!OMIT_CLASSNAME_REGEX.test(typeText)) {
            const renderFunctionNode =
              analyzer.services.tsNodeToESTreeNodeMap.get(
                analysis.renderFunction,
              ) as
                | TSESTree.ArrowFunctionExpression
                | TSESTree.FunctionDeclaration
                | TSESTree.FunctionExpression
                | undefined;
            const renderBodyNode = renderFunctionNode?.body;
            const parameterReplacementText =
              estreeParameter == null
                ? undefined
                : buildParameterReplacementText(
                    estreeParameter,
                    typeText,
                    context.sourceCode,
                  );

            if (
              renderBodyNode != null &&
              !hasClassNamePropUsage(
                renderBodyNode,
                context.sourceCode,
                analyzer,
                analysis,
              )
            ) {
              autofix = (fixer) => {
                return parameterReplacementText == null
                  ? [
                      fixer.replaceText(
                        typeAnnotation.typeAnnotation,
                        `Omit<${typeText}, "className">`,
                      ),
                    ]
                  : estreeParameter == null
                    ? []
                    : [
                        fixer.replaceText(
                          estreeParameter,
                          parameterReplacementText,
                        ),
                      ];
              };
            }

            if (autofix == null) {
              suggestions.push({
                messageId: "suggestOmit" as const,
                fix: (fixer: TSESLint.RuleFixer) => {
                  return parameterReplacementText == null
                    ? [
                        fixer.replaceText(
                          typeAnnotation.typeAnnotation,
                          `Omit<${typeText}, "className">`,
                        ),
                      ]
                    : estreeParameter == null
                      ? []
                      : [
                          fixer.replaceText(
                            estreeParameter,
                            parameterReplacementText,
                          ),
                        ];
                },
              });
            }
          }
        }
      }

      context.report({
        node: reportNode,
        messageId: "forbid",
        data: {
          name: analysis.name,
        },
        ...(autofix == null ? {} : { fix: autofix }),
        ...(suggestions.length > 0 ? { suggest: suggestions } : {}),
      });
    }

    return {
      FunctionDeclaration: report,
      VariableDeclarator: report,
    };
  },
});
