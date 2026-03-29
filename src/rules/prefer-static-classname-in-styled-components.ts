import type { TSESTree } from "@typescript-eslint/types";
import ts from "typescript";
import { createComponentAnalyzer } from "./component-analysis";
import {
  buildClassNameAttributeText,
  getPreferredClassNameReplacement,
} from "./render-classname-utils";
import { createEslintRule } from "../utils";

export const RULE_NAME = "prefer-static-classname-in-styled-components";
export type MessageIds = "preferStatic";
export type Options = [];

function getSymbol(
  node: ts.Node,
  checker: ts.TypeChecker,
): ts.Symbol | undefined {
  const symbol = checker.getSymbolAtLocation(node);
  if (symbol == null) {
    return undefined;
  }

  // TypeScript exposes alias state through symbol bit flags.
   
  if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    return checker.getAliasedSymbol(symbol);
  }

  return symbol;
}

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
        "Prefer plain JSX string literals for static className values and simplify className composition in clsx(...).",
    },
  },
  defaultOptions: [],
  create: (context) => {
    const analyzer = createComponentAnalyzer(context);
    const {sourceCode} = context;

    function resolveIdentifier(
      node: TSESTree.Identifier,
    ): TSESTree.Expression | undefined {
      const tsNode = analyzer.services.esTreeNodeToTSNodeMap.get(node);
      const symbol = getSymbol(tsNode, analyzer.checker);
      const declaration = symbol?.valueDeclaration;
      if (
        declaration == null ||
        !ts.isVariableDeclaration(declaration) ||
        declaration.initializer == null
      ) {
        return undefined;
      }

      const declarationList = declaration.parent;
      if (
        !ts.isVariableDeclarationList(declarationList) ||
        (declarationList.flags & ts.NodeFlags.Const) === 0
      ) {
        return undefined;
      }

      const expression = analyzer.services.tsNodeToESTreeNodeMap.get(
        declaration.initializer,
      );
      return expression != null && "type" in expression
        ? (expression as TSESTree.Expression)
        : undefined;
    }

    return {
      JSXAttribute(node) {
        if (!isClassNameAttribute(node)) {
          return;
        }

        const analysis = analyzer.getEnclosingComponentAnalysis(node);
        if (analysis == null || !analysis.hasInternalStyle) {
          return;
        }

        const replacement = getPreferredClassNameReplacement(
          node.value.expression,
          {
            getText: (currentNode) => sourceCode.getText(currentNode),
            helperName: "clsx",
            resolveIdentifier,
          },
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
