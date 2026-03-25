import type { TSESTree } from "@typescript-eslint/types";

const CLASSNAME_HELPER_NAMES = new Set(["clsx", "cn"]);

interface TextSourceCode {
  getText: (node?: TSESTree.Node) => string;
}

interface ReplacementOptions {
  getText: (node: TSESTree.Node) => string;
  helperName?: string;
  resolveIdentifier?: (
    node: TSESTree.Identifier,
  ) => TSESTree.Expression | undefined;
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

function unwrapExpression(
  expression: TSESTree.Expression,
): TSESTree.Expression {
  let current = expression;
  while (true) {
    if (current.type === "TSAsExpression") {
      current = current.expression;
      continue;
    }
    if (current.type === "TSSatisfiesExpression") {
      current = current.expression;
      continue;
    }
    if (current.type === "TSNonNullExpression") {
      current = current.expression;
      continue;
    }
    break;
  }
  return current;
}

function resolveExpression(
  expression: TSESTree.Expression,
  options: Pick<ReplacementOptions, "resolveIdentifier">,
  visited = new Set<TSESTree.Node>(),
): TSESTree.Expression {
  const unwrapped = unwrapExpression(expression);
  if (visited.has(unwrapped)) {
    return unwrapped;
  }

  if (unwrapped.type === "Identifier" && options.resolveIdentifier != null) {
    visited.add(unwrapped);
    const resolved = options.resolveIdentifier(unwrapped);
    if (resolved != null) {
      return resolveExpression(resolved, options, visited);
    }
  }

  return unwrapped;
}

function getTemplateLiteralText(node: TSESTree.TemplateLiteral): string {
  return node.quasis
    .map((quasi) => quasi.value.cooked ?? quasi.value.raw)
    .join("");
}

function getStaticClassNameText(
  expression: TSESTree.Expression,
  options: Pick<ReplacementOptions, "resolveIdentifier">,
  visited = new Set<TSESTree.Node>(),
): string | undefined {
  const resolved = resolveExpression(expression, options, visited);
  if (visited.has(resolved)) {
    return undefined;
  }

  if (resolved.type === "Literal" && typeof resolved.value === "string") {
    return resolved.value;
  }

  if (resolved.type === "TemplateLiteral") {
    if (resolved.expressions.length === 0) {
      return getTemplateLiteralText(resolved);
    }

    visited.add(resolved);
    let text =
      resolved.quasis[0]?.value.cooked ?? resolved.quasis[0]?.value.raw;
    if (text == null) {
      return undefined;
    }

    for (const [index, subexpression] of resolved.expressions.entries()) {
      const expressionText = getStaticClassNameText(
        subexpression,
        options,
        visited,
      );
      if (expressionText == null) {
        return undefined;
      }

      const quasi = resolved.quasis[index + 1];
      text += expressionText;
      text += quasi?.value.cooked ?? quasi?.value.raw ?? "";
    }

    return text;
  }

  if (!isClassNameHelperCall(resolved)) {
    return undefined;
  }

  const tokens: Array<string> = [];
  for (const argument of resolved.arguments) {
    if (argument.type === "SpreadElement") {
      return undefined;
    }

    const argumentTokens = getStaticClassNameTokens(argument, options, visited);
    if (argumentTokens == null) {
      return undefined;
    }
    tokens.push(...argumentTokens);
  }

  return tokens.join(" ");
}

function getStaticClassNameTokens(
  expression: TSESTree.Expression,
  options: Pick<ReplacementOptions, "resolveIdentifier">,
  visited = new Set<TSESTree.Node>(),
): Array<string> | undefined {
  const text = getStaticClassNameText(expression, options, visited);
  return text == null ? undefined : normalizeClassNameText(text);
}

function isWhitespaceDelimitedTemplateLiteral(
  node: TSESTree.TemplateLiteral,
): boolean {
  return node.expressions.every((_, index) => {
    const previous = node.quasis[index];
    const next = node.quasis[index + 1];
    const previousText = previous?.value.cooked ?? previous?.value.raw ?? "";
    const nextText = next?.value.cooked ?? next?.value.raw ?? "";
    return (
      (previousText.length === 0 || /\s$/u.test(previousText)) &&
      (nextText.length === 0 || /^\s/u.test(nextText))
    );
  });
}

function isSafeClsxArgumentExpression(
  expression: TSESTree.Expression,
  options: Pick<ReplacementOptions, "resolveIdentifier">,
  visited = new Set<TSESTree.Node>(),
): boolean {
  if (getStaticClassNameText(expression, options, visited) != null) {
    return true;
  }

  const resolved = resolveExpression(expression, options, visited);
  if (visited.has(resolved)) {
    return false;
  }

  if (
    resolved.type === "Identifier" ||
    resolved.type === "MemberExpression" ||
    resolved.type === "CallExpression"
  ) {
    return true;
  }

  if (resolved.type === "ConditionalExpression") {
    visited.add(resolved);
    return (
      isSafeClsxArgumentExpression(resolved.consequent, options, visited) &&
      isSafeClsxArgumentExpression(resolved.alternate, options, visited)
    );
  }

  if (resolved.type === "LogicalExpression") {
    visited.add(resolved);
    return (
      (resolved.operator === "&&" ||
        resolved.operator === "||" ||
        resolved.operator === "??") &&
      isSafeClsxArgumentExpression(resolved.right, options, visited)
    );
  }

  return false;
}

function toClassNameStringArgumentText(text: string): string {
  return JSON.stringify(normalizeClassNameText(text).join(" "));
}

function isEmptyStaticClassNameExpression(
  expression: TSESTree.Expression,
  options: Pick<ReplacementOptions, "resolveIdentifier">,
): boolean {
  const staticText = getStaticClassNameText(expression, options);
  return staticText != null && normalizeClassNameText(staticText).length === 0;
}

function getSimplifiedClsxArgumentText(
  expression: TSESTree.Expression,
  options: ReplacementOptions,
): string | undefined {
  const resolved = resolveExpression(expression, options);
  if (resolved.type !== "ConditionalExpression") {
    return undefined;
  }

  const consequentText = getStaticClassNameText(resolved.consequent, options);
  if (
    consequentText == null ||
    normalizeClassNameText(consequentText).length === 0 ||
    !isEmptyStaticClassNameExpression(resolved.alternate, options)
  ) {
    return undefined;
  }

  return `(${options.getText(resolved.test)}) && ${toClassNameStringArgumentText(
    consequentText,
  )}`;
}

function toStaticClassNameReplacement(
  expression: TSESTree.Expression,
  options: Pick<ReplacementOptions, "resolveIdentifier">,
): ClassNameReplacement | undefined {
  const tokens = getStaticClassNameTokens(expression, options);
  return tokens == null
    ? undefined
    : {
        kind: "string",
        text: tokens.join(" "),
      };
}

function toTemplateClassNameReplacement(
  expression: TSESTree.Expression,
  options: ReplacementOptions,
): ClassNameReplacement | undefined {
  const resolved = resolveExpression(expression, options);
  if (
    resolved.type !== "TemplateLiteral" ||
    resolved.expressions.length === 0
  ) {
    return undefined;
  }

  const staticReplacement = toStaticClassNameReplacement(resolved, options);
  if (staticReplacement != null) {
    return staticReplacement;
  }

  if (!isWhitespaceDelimitedTemplateLiteral(resolved)) {
    return undefined;
  }

  const argumentsText: Array<string> = [];
  let hasDynamicArgument = false;

  for (const [index, quasi] of resolved.quasis.entries()) {
    const staticTokens = normalizeClassNameText(
      quasi.value.cooked ?? quasi.value.raw,
    );
    if (staticTokens.length > 0) {
      argumentsText.push(JSON.stringify(staticTokens.join(" ")));
    }

    const subexpression = resolved.expressions[index];
    if (subexpression == null) {
      continue;
    }

    const staticText = getStaticClassNameText(subexpression, options);
    if (staticText != null) {
      const tokens = normalizeClassNameText(staticText);
      if (tokens.length > 0) {
        argumentsText.push(JSON.stringify(tokens.join(" ")));
      }
      continue;
    }

    if (!isSafeClsxArgumentExpression(subexpression, options)) {
      return undefined;
    }

    hasDynamicArgument = true;
    argumentsText.push(
      getSimplifiedClsxArgumentText(subexpression, options) ??
        options.getText(subexpression),
    );
  }

  if (!hasDynamicArgument) {
    return argumentsText.length === 0
      ? {
          kind: "string",
          text: "",
        }
      : {
          kind: "string",
          text: argumentsText
            .map((argumentText) => JSON.parse(argumentText) as string)
            .join(" "),
        };
  }

  return {
    kind: "expression",
    text: `${options.helperName ?? "clsx"}(${argumentsText.join(", ")})`,
  };
}

function toHelperClassNameReplacement(
  expression: TSESTree.Expression,
  options: ReplacementOptions,
): ClassNameReplacement | undefined {
  const resolved = resolveExpression(expression, options);
  if (!isClassNameHelperCall(resolved)) {
    return undefined;
  }

  const argumentsText = resolved.arguments.map((argument) => {
    if (argument.type === "SpreadElement") {
      return {
        changed: false,
        text: options.getText(argument),
      };
    }

    const simplifiedText = getSimplifiedClsxArgumentText(argument, options);
    return {
      changed: simplifiedText != null,
      text: simplifiedText ?? options.getText(argument),
    };
  });

  if (!argumentsText.some((argument) => argument.changed)) {
    return undefined;
  }

  return {
    kind: "expression",
    text: `${options.getText(resolved.callee)}(${argumentsText
      .map((argument) => argument.text)
      .join(", ")})`,
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
  options: Pick<ReplacementOptions, "resolveIdentifier"> = {},
): ClassNameReplacement | undefined {
  return toStaticClassNameReplacement(expression, options);
}

export function getPreferredClassNameReplacement(
  expression: TSESTree.Expression,
  options: ReplacementOptions,
): ClassNameReplacement | undefined {
  return (
    toStaticClassNameReplacement(expression, options) ??
    toTemplateClassNameReplacement(expression, options) ??
    toHelperClassNameReplacement(expression, options)
  );
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

  const staticReplacement = toStaticClassNameReplacementFromArguments(
    remainingArguments,
    {},
  );
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
  options: Pick<ReplacementOptions, "resolveIdentifier">,
): ClassNameReplacement | undefined {
  const tokens: Array<string> = [];
  for (const argument of arguments_) {
    if (argument.type === "SpreadElement") {
      return undefined;
    }

    const argumentTokens = getStaticClassNameTokens(argument, options);
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
