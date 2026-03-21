import type { TSESTree } from "@typescript-eslint/types";
import { AST_NODE_TYPES, ESLintUtils } from "@typescript-eslint/utils";
import type * as TSESLint from "@typescript-eslint/utils/ts-eslint";
import { createEslintRule } from "../utils";

export const RULE_NAME = "sort-destructure-keys-by-type";
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

function calculateTypeDeclarationOrder({
  node,
  context,
  options,
}: {
  node: TSESTree.Node;
  context: Readonly<TSESLint.RuleContext<MessageIds, Options>>;
  options: { typeNameRegex?: string; includeAnonymousType?: boolean };
}) {
  const services = ESLintUtils.getParserServices(context);
  const type = services.getTypeAtLocation(node);

  const typeDeclarationsOrder: Array<string> = [];
  const typeName = type.symbol?.escapedName;
  if (
    typeName == null ||
    // eslint-disable-next-line eqeqeq
    type.symbol.escapedName == "__type"
      ? options.includeAnonymousType
      : options.typeNameRegex == null ||
        new RegExp(options.typeNameRegex).test(typeName)
  ) {
    const subTypes = type.isUnionOrIntersection() ? type.types : [type];
    for (const subType of subTypes) {
      for (const property of subType.getProperties()) {
        if (typeof property?.escapedName === "string") {
          typeDeclarationsOrder.push(property.escapedName);
        }
      }
    }
  }

  return typeDeclarationsOrder;
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

function checkObjectPattern({
  node,
  context,
  options,
}: {
  node: TSESTree.ObjectPattern;
  context: Readonly<TSESLint.RuleContext<MessageIds, Options>>;
  options: { typeNameRegex?: string; includeAnonymousType?: boolean };
}) {
  const typesOrder = calculateTypeDeclarationOrder({
    node,
    context,
    options,
  });

  const identifiers: Array<TSESTree.Identifier> = [];
  for (const property of node.properties) {
    if (property.value == null) {
      continue;
    }
    if (property.type !== AST_NODE_TYPES.Property) {
      continue;
    }
    switch (property.value.type) {
      case AST_NODE_TYPES.ObjectPattern: {
        checkObjectPattern({
          node: property.value,
          context,
          options,
        });
        if (property.key.type === AST_NODE_TYPES.Identifier) {
          identifiers.push(property.key);
        }
        break;
      }
      case AST_NODE_TYPES.Identifier: {
        identifiers.push(property.value);
        break;
      }
      case AST_NODE_TYPES.AssignmentPattern: {
        const leftProperty = property.value.left;
        if (leftProperty.type === AST_NODE_TYPES.Identifier) {
          identifiers.push(leftProperty);
        }
        if (leftProperty.type === AST_NODE_TYPES.ObjectPattern) {
          checkObjectPattern({
            node: leftProperty,
            context,
            options,
          });
          if (property.key.type === AST_NODE_TYPES.Identifier) {
            identifiers.push(property.key);
          }
        }
        break;
      }
    }
  }

  const result = checkOrder({
    order: typesOrder,
    values: identifiers,
  });
  if (result.type === "lintError") {
    reportError({ context, result });
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
    schema: [
      {
        type: "object",
        properties: {
          typeNameRegex: {
            type: "string",
          },
          includeAnonymousType: {
            type: "boolean",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      sort: `Expected object keys to be sorted order by type order. Expected \`{{first}}\` to be before \`{{second}}\`.`,
    },
  },
  defaultOptions: [],
  create: (context) => {
    const options: {
      typeNameRegex?: string;
      includeAnonymousType?: boolean;
    } = Object.assign(
      { includeAnonymousType: true },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      context.options[0],
    );

    return {
      VariableDeclaration(node) {
        for (const declaration of node.declarations) {
          if (declaration.id.type === AST_NODE_TYPES.ObjectPattern) {
            checkObjectPattern({
              node: declaration.id,
              context,
              options,
            });
          }
        }
      },
    };
  },
});
