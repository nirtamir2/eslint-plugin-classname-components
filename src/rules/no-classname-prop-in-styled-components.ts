import type { TSESTree } from "@typescript-eslint/types";
import type * as TSESLint from "@typescript-eslint/utils/ts-eslint";
import type { ComponentAnalysis } from "./component-analysis";
import { createComponentAnalyzer, isClassPropName } from "./component-analysis";
import { createEslintRule } from "../utils";

export const RULE_NAME = "no-classname-prop-in-styled-components";
export type MessageIds = "forbid" | "suggestOmit";
export type Options = [];
const OMIT_CLASS_PROP_REGEX =
  /^Omit<.*,\s*(?:"class"|"className")(?:\s*\|\s*(?:"class"|"className"))?\s*>$/s;

function toOmitKeysText(names: ReadonlyArray<string>): string {
  return names.map((name) => JSON.stringify(name)).join(" | ");
}

function toExposedPropText(names: ReadonlyArray<string>): string {
  return names.map((name) => `\`${name}\``).join(" or ");
}

function toOmitClassPropType(
  typeText: string,
  names: ReadonlyArray<string>,
): string {
  return `Omit<${typeText}, ${toOmitKeysText(names)}>`;
}

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
    return !isClassPropName(propertyName);
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
  omittedTypeText: string,
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

  if (parameter.type === "AssignmentPattern") {
    return `${patternText}: ${omittedTypeText} = ${sourceCode.getText(parameter.right)}`;
  }

  return `${patternText}: ${omittedTypeText}`;
}

function hasClassNamePropUsage(
  node: TSESTree.Node,
  usage: {
    analysis: ComponentAnalysis;
    analyzer: ReturnType<typeof createComponentAnalyzer>;
    sourceCode: Readonly<TSESLint.SourceCode>;
  },
): boolean {
  if (
    usage.analyzer.services.esTreeNodeToTSNodeMap.has(node) &&
    usage.analyzer.isClassNamePropExpression(
      node as TSESTree.Expression,
      usage.analysis,
    )
  ) {
    return true;
  }

  for (const key of usage.sourceCode.visitorKeys[node.type] ?? []) {
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
          hasClassNamePropUsage(item as TSESTree.Node, usage)
        ) {
          return true;
        }
      }
      continue;
    }

    if (
      typeof value === "object" &&
      "type" in value &&
      hasClassNamePropUsage(value as TSESTree.Node, usage)
    ) {
      return true;
    }
  }

  return false;
}

function getOmitClassPropFixes(
  fixer: TSESLint.RuleFixer,
  omitFix: {
    estreeParameter: TSESTree.Parameter | undefined;
    omittedTypeText: string;
    parameterReplacementText: string | undefined;
    typeAnnotation: TSESTree.TSTypeAnnotation;
  },
): Array<TSESLint.RuleFix> {
  if (omitFix.parameterReplacementText == null) {
    return [
      fixer.replaceText(
        omitFix.typeAnnotation.typeAnnotation,
        omitFix.omittedTypeText,
      ),
    ];
  }

  return omitFix.estreeParameter == null
    ? []
    : [
        fixer.replaceText(
          omitFix.estreeParameter,
          omitFix.parameterReplacementText,
        ),
      ];
}

export default createEslintRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow exposing className or class props from components that already style themselves internally",
    },
    fixable: "code",
    hasSuggestions: true,
    schema: [],
    messages: {
      forbid:
        'Styled component "{{name}}" should not expose a {{prop}} prop. Remove it from the component API and model styling differences with variant props instead.',
      suggestOmit: "Wrap the component props type in `Omit<T, {{keys}}>`.",
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

      const omitReport: {
        fix?: (fixer: TSESLint.RuleFixer) => ReadonlyArray<TSESLint.RuleFix>;
        suggest?: Array<{
          data: { keys: string };
          fix: (fixer: TSESLint.RuleFixer) => ReadonlyArray<TSESLint.RuleFix>;
          messageId: "suggestOmit";
        }>;
      } = {};
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
          if (!OMIT_CLASS_PROP_REGEX.test(typeText)) {
            const omittedTypeText = toOmitClassPropType(
              typeText,
              analysis.exposedClassPropNames,
            );
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
                    omittedTypeText,
                    context.sourceCode,
                  );
            const applyOmitFix = (fixer: TSESLint.RuleFixer) => {
              return getOmitClassPropFixes(fixer, {
                estreeParameter,
                omittedTypeText,
                parameterReplacementText,
                typeAnnotation,
              });
            };

            if (
              renderBodyNode != null &&
              !hasClassNamePropUsage(renderBodyNode, {
                analysis,
                analyzer,
                sourceCode: context.sourceCode,
              })
            ) {
              omitReport.fix = applyOmitFix;
            } else {
              omitReport.suggest = [
                {
                  messageId: "suggestOmit",
                  data: {
                    keys: toOmitKeysText(analysis.exposedClassPropNames),
                  },
                  fix: applyOmitFix,
                },
              ];
            }
          }
        }
      }

      context.report({
        node: reportNode,
        messageId: "forbid",
        data: {
          name: analysis.name,
          prop: toExposedPropText(analysis.exposedClassPropNames),
        },
        ...(omitReport.fix == null ? {} : { fix: omitReport.fix }),
        ...(omitReport.suggest == null
          ? {}
          : { suggest: omitReport.suggest }),
      });
    }

    return {
      FunctionDeclaration: report,
      VariableDeclarator: report,
    };
  },
});
