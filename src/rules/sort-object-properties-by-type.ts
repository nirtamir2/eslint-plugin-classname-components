import { getTypeOfPropertyOfName } from "@typescript-eslint/type-utils";
import type { TSESTree } from "@typescript-eslint/types";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import type * as TSESLint from "@typescript-eslint/utils/ts-eslint";
import type ts from "typescript";
import { TypeFlags } from "typescript";
import { createEslintRule } from "../utils";

export const RULE_NAME = "sort-object-properties-by-type";
export type MessageIds = "sort";
export type Options = [];

type OrderResult =
  | { type: "success" }
  | { type: "error"; value: TSESTree.Identifier; message: string }
  | {
      type: "lintError";
      value: TSESTree.Identifier;
      shouldBeBefore: TSESTree.Identifier;
    };

function checkOrder({
  order,
  values,
}: {
  order: Array<string>;
  values: Array<TSESTree.Identifier>;
}): OrderResult {
  let lastIndex = -1;
  let lastValue: TSESTree.Identifier | null = null;

  for (const value of values) {
    const index = order.indexOf(value.name);

    if (index === -1) {
      return { type: "error", value, message: "Not in order array" };
    }

    if (index < lastIndex && lastValue != null) {
      return { type: "lintError", value: lastValue, shouldBeBefore: value };
    }

    lastIndex = index;
    lastValue = value;
  }

  return { type: "success" };
}

function reportError({
  context,
  result,
}: {
  context: Readonly<TSESLint.RuleContext<MessageIds, Options>>;
  result: {
    value: TSESTree.Identifier;
    shouldBeBefore: TSESTree.Identifier;
  };
}) {
  context.report({
    node: result.value,
    messageId: "sort",
    data: {
      first: result.shouldBeBefore.name,
      second: result.value.name,
    },
    fix: (fixer) => {
      return [
        fixer.replaceTextRange(
          result.value.parent.range,
          context.sourceCode.getText(result.shouldBeBefore.parent),
        ),
        fixer.replaceTextRange(
          result.shouldBeBefore.parent.range,
          context.sourceCode.getText(result.value.parent),
        ),
      ];
    },
  });
}

function handleObjectExpression({
  typeChecker,
  type,
  objectExpression,
  context,
}: {
  type: ts.Type;
  typeChecker: ts.TypeChecker;
  objectExpression: TSESTree.ObjectExpression;
  context: Readonly<TSESLint.RuleContext<MessageIds, Options>>;
}) {
  const order = (type.isUnionOrIntersection() ? type.types : [type]).flatMap(
    (type) => {
      if (type.getFlags() !== TypeFlags.Object) {
        return [];
      }
      return typeChecker.getPropertiesOfType(type).map((a) => a.getName());
    },
  );

  const identifiers: Array<TSESTree.Identifier> = [];

  for (const property of objectExpression.properties) {
    switch (property.type) {
      case AST_NODE_TYPES.SpreadElement: {
        continue;
      }
      case AST_NODE_TYPES.Property: {
        if (
          property.type === AST_NODE_TYPES.Property &&
          property.key.type === AST_NODE_TYPES.Identifier
        ) {
          identifiers.push(property.key);
        }
        if (property.value.type === AST_NODE_TYPES.ObjectExpression) {
          if (property.key.type !== AST_NODE_TYPES.Identifier) {
            continue;
          }

          const propertyType = getTypeOfPropertyOfName(
            typeChecker,
            type,
            property.key.name,
          );

          if (propertyType == null) {
            continue;
          }

          handleObjectExpression({
            type: propertyType,
            typeChecker,
            objectExpression: property.value,
            context,
          });
        }
      }
    }
  }
  const result = checkOrder({
    values: identifiers,
    order,
  });
  if (result.type === "lintError") {
    reportError({ context, result });
  }
}

function handleArrayExpression({
  type,
  typeChecker,
  arrayExpression,
  context,
}: {
  type: ts.Type;
  typeChecker: ts.TypeChecker;
  arrayExpression: TSESTree.ArrayExpression;
  context: Readonly<TSESLint.RuleContext<MessageIds, Options>>;
}) {
  for (const property of arrayExpression.elements) {
    if (property == null) {
      continue;
    }

    if (property.type === AST_NODE_TYPES.ObjectExpression) {
      const objectType = type.getNumberIndexType();
      if (objectType == null) {
        return;
      }
      handleObjectExpression({
        objectExpression: property,
        context,
        typeChecker,
        type: objectType,
      });
    }
  }
}

export default createEslintRule<Options, MessageIds>({
  name: RULE_NAME,
  meta: {
    type: "layout",
    docs: {
      description: "Sort destructuring keys based on type order",
    },
    fixable: "code",
    schema: [],
    messages: {
      sort: `Expected object keys to be sorted order by type order. Expected \`{{first}}\` to be before \`{{second}}\`.`,
    },
  },
  defaultOptions: [],
  create: (context) => {
    const services = ESLintUtils.getParserServices(context);
    const typeChecker = services.program.getTypeChecker();
    return {
      VariableDeclaration(node) {
        for (const declaration of node.declarations) {
          if (declaration.init == null) {
            continue;
          }
          const tsNode = services.esTreeNodeToTSNodeMap.get(declaration);
          const rootType = typeChecker.getTypeAtLocation(tsNode);

          switch (declaration.init.type) {
            case AST_NODE_TYPES.ObjectExpression: {
              handleObjectExpression({
                type: rootType,
                typeChecker,
                context,
                objectExpression: declaration.init,
              });
              break;
            }
            case AST_NODE_TYPES.ArrayExpression: {
              handleArrayExpression({
                arrayExpression: declaration.init,
                context,
                type: rootType,
                typeChecker,
              });
              break;
            }
          }
        }
      },
    };
  },
});
