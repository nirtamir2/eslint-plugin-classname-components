import type { TSESTree } from "@typescript-eslint/types";

const CLASSNAME_HELPER_NAMES = new Set(["clsx", "cn"]);

interface TextSourceCode {
  getText: (node?: TSESTree.Node) => string;
}

export interface ClassNameReplacement {
  kind: "expression" | "string";
  text: string;
}

function normalizeClassNameText(text: string): Array<string> {
  return text
    .trim()
    .split(/\s+/u)
    .filter((token) => token.length > 0);
}

function getCallLikeName(
  callee: TSESTree.CallExpression["callee"],
): string | undefined {
  if (callee.type === "Identifier") {
    return callee.name;
  }

  return callee.type === "MemberExpression" &&
    callee.property.type === "Identifier" &&
    callee.computed === false
    ? callee.property.name
    : undefined;
}

function isClassNameHelperCall(
  expression: TSESTree.Expression,
): expression is TSESTree.CallExpression {
  return (
    expression.type === "CallExpression" &&
    CLASSNAME_HELPER_NAMES.has(getCallLikeName(expression.callee) ?? "")
  );
}

function getStaticClassNameTokens(
  expression: TSESTree.Expression,
): Array<string> | undefined {
  if (expression.type === "Literal" && typeof expression.value === "string") {
    return normalizeClassNameText(expression.value);
  }

  if (
    expression.type === "TemplateLiteral" &&
    expression.expressions.length === 0
  ) {
    return normalizeClassNameText(
      expression.quasis
        .map((quasi) => quasi.value.cooked ?? quasi.value.raw)
        .join(""),
    );
  }

  if (!isClassNameHelperCall(expression)) {
    return undefined;
  }

  const tokens: Array<string> = [];
  for (const argument of expression.arguments) {
    if (argument.type === "SpreadElement") {
      return undefined;
    }

    const argumentTokens = getStaticClassNameTokens(argument);
    if (argumentTokens == null) {
      return undefined;
    }
    tokens.push(...argumentTokens);
  }

  return tokens;
}

function toStaticClassNameReplacement(
  expression: TSESTree.Expression,
): ClassNameReplacement | undefined {
  const tokens = getStaticClassNameTokens(expression);
  return tokens == null
    ? undefined
    : {
        kind: "string",
        text: tokens.join(" "),
      };
}

function escapeJsxAttributeString(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildClassNameAttributeText(
  replacement: ClassNameReplacement,
): string {
  return replacement.kind === "string"
    ? `className="${escapeJsxAttributeString(replacement.text)}"`
    : `className={${replacement.text}}`;
}

export function getStaticClassNameReplacement(
  expression: TSESTree.Expression,
): ClassNameReplacement | undefined {
  return toStaticClassNameReplacement(expression);
}

export function hasClassNamePropMerge(
  expression: TSESTree.Expression,
  isClassNamePropExpression: (node: TSESTree.Expression) => boolean,
): boolean {
  if (isClassNamePropExpression(expression)) {
    return true;
  }

  return (
    isClassNameHelperCall(expression) &&
    expression.arguments.some((argument) => {
      return (
        argument.type !== "SpreadElement" && isClassNamePropExpression(argument)
      );
    })
  );
}

export function getClassNamePropMergeReplacement(
  expression: TSESTree.Expression,
  sourceCode: TextSourceCode,
  isClassNamePropExpression: (node: TSESTree.Expression) => boolean,
): ClassNameReplacement | undefined {
  if (
    isClassNamePropExpression(expression) ||
    !isClassNameHelperCall(expression)
  ) {
    return undefined;
  }

  const remainingArguments = expression.arguments.filter((argument) => {
    return (
      argument.type === "SpreadElement" || !isClassNamePropExpression(argument)
    );
  });

  if (
    remainingArguments.length === expression.arguments.length ||
    remainingArguments.length === 0
  ) {
    return undefined;
  }

  const staticReplacement =
    toStaticClassNameReplacementFromArguments(remainingArguments);
  if (staticReplacement != null) {
    return staticReplacement;
  }

  const [firstRemainingArgument] = remainingArguments;
  if (remainingArguments.length === 1 && firstRemainingArgument != null) {
    if (firstRemainingArgument.type === "SpreadElement") {
      return {
        kind: "expression",
        text: `${sourceCode.getText(expression.callee)}(${sourceCode.getText(
          firstRemainingArgument,
        )})`,
      };
    }

    return {
      kind: "expression",
      text: sourceCode.getText(firstRemainingArgument),
    };
  }

  return {
    kind: "expression",
    text: `${sourceCode.getText(expression.callee)}(${remainingArguments
      .map((argument) => sourceCode.getText(argument))
      .join(", ")})`,
  };
}

function toStaticClassNameReplacementFromArguments(
  arguments_: ReadonlyArray<TSESTree.CallExpressionArgument>,
): ClassNameReplacement | undefined {
  const tokens: Array<string> = [];
  for (const argument of arguments_) {
    if (argument.type === "SpreadElement") {
      return undefined;
    }

    const argumentTokens = getStaticClassNameTokens(argument);
    if (argumentTokens == null) {
      return undefined;
    }
    tokens.push(...argumentTokens);
  }

  return {
    kind: "string",
    text: tokens.join(" "),
  };
}
