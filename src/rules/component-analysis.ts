import { ESLintUtils } from "@typescript-eslint/utils";
import type { TSESTree } from "@typescript-eslint/types";
import type { RuleContext } from "@typescript-eslint/utils/ts-eslint";
import ts from "typescript";

type StyleClassification = "internal" | "passthrough" | "unknown";
const COMPONENT_NAME_REGEX = /^[A-Z]/;
const CLASSNAME_HELPER_NAMES = new Set(["clsx", "cn"]);

function isInternalLiteralText(text: string): boolean {
  return text.trim().length > 0;
}

interface ComponentDefinition {
  declaration: ts.Declaration;
  name: string;
  propsParameter: ts.ParameterDeclaration | undefined;
  renderFunction:
    | ts.ArrowFunction
    | ts.FunctionDeclaration
    | ts.FunctionExpression;
}

export interface ComponentAnalysis extends ComponentDefinition {
  exposesClassNameProp: boolean;
  hasInternalStyle: boolean;
}

function isUppercaseComponentName(name: string): boolean {
  return COMPONENT_NAME_REGEX.test(name);
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (true) {
    if (ts.isAsExpression(current) || ts.isParenthesizedExpression(current)) {
      current = current.expression;
      continue;
    }
    if (ts.isSatisfiesExpression(current)) {
      current = current.expression;
      continue;
    }
    if (
      ts.isTypeAssertionExpression(current) ||
      ts.isNonNullExpression(current)
    ) {
      current = current.expression;
      continue;
    }
    break;
  }
  return current;
}

function getCallLikeName(expression: ts.Expression): string | undefined {
  const callee = unwrapExpression(expression);
  if (ts.isIdentifier(callee)) {
    return callee.text;
  }
  if (ts.isPropertyAccessExpression(callee)) {
    return callee.name.text;
  }
  return undefined;
}

function isClassNameHelperName(name: string | undefined): boolean {
  return name != null && CLASSNAME_HELPER_NAMES.has(name);
}

function unwrapComponentInitializer(
  expression: ts.Expression,
): ComponentDefinition["renderFunction"] | undefined {
  const unwrapped = unwrapExpression(expression);
  if (ts.isArrowFunction(unwrapped) || ts.isFunctionExpression(unwrapped)) {
    return unwrapped;
  }
  if (!ts.isCallExpression(unwrapped)) {
    return undefined;
  }

  const calleeName = getCallLikeName(unwrapped.expression);
  if (calleeName !== "forwardRef" && calleeName !== "memo") {
    return undefined;
  }

  const firstArgument = unwrapped.arguments[0];
  return firstArgument == null
    ? undefined
    : unwrapComponentInitializer(firstArgument);
}

function visitNode(
  node: ts.Node,
  visitor: (current: ts.Node) => void,
  options: { skipNestedFunctions?: boolean } = {},
) {
  function visit(current: ts.Node) {
    if (
      options.skipNestedFunctions === true &&
      current !== node &&
      ts.isFunctionLike(current)
    ) {
      return;
    }
    visitor(current);
    ts.forEachChild(current, visit);
  }
  visit(node);
}

function expressionContainsJsx(expression: ts.Expression): boolean {
  let hasJsx = false;
  visitNode(expression, (current) => {
    if (
      ts.isJsxElement(current) ||
      ts.isJsxFragment(current) ||
      ts.isJsxSelfClosingElement(current)
    ) {
      hasJsx = true;
    }
  });
  return hasJsx;
}

function collectReturnedExpressions(
  renderFunction: ComponentDefinition["renderFunction"],
): Array<ts.Expression> {
  if (ts.isArrowFunction(renderFunction) && renderFunction.body != null) {
    if (ts.isBlock(renderFunction.body)) {
      const expressions: Array<ts.Expression> = [];
      visitNode(
        renderFunction.body,
        (current) => {
          if (ts.isReturnStatement(current) && current.expression != null) {
            expressions.push(current.expression);
          }
        },
        { skipNestedFunctions: true },
      );
      return expressions;
    }
    return [renderFunction.body];
  }

  if (renderFunction.body == null) {
    return [];
  }

  const expressions: Array<ts.Expression> = [];
  visitNode(
    renderFunction.body,
    (current) => {
      if (ts.isReturnStatement(current) && current.expression != null) {
        expressions.push(current.expression);
      }
    },
    { skipNestedFunctions: true },
  );
  return expressions;
}

function getComponentDefinition(
  declaration: ts.Declaration,
): ComponentDefinition | undefined {
  if (ts.isFunctionDeclaration(declaration)) {
    const name = declaration.name?.text;
    if (
      name == null ||
      declaration.body == null ||
      !isUppercaseComponentName(name)
    ) {
      return undefined;
    }

    const hasJsxReturn = collectReturnedExpressions(declaration).some(
      (expression) => {
        return expressionContainsJsx(expression);
      },
    );
    if (!hasJsxReturn) {
      return undefined;
    }

    return {
      declaration,
      name,
      propsParameter: declaration.parameters[0],
      renderFunction: declaration,
    };
  }

  if (
    !ts.isVariableDeclaration(declaration) ||
    !ts.isIdentifier(declaration.name)
  ) {
    return undefined;
  }

  const name = declaration.name.text;
  if (!isUppercaseComponentName(name) || declaration.initializer == null) {
    return undefined;
  }

  const renderFunction = unwrapComponentInitializer(declaration.initializer);
  if (renderFunction == null) {
    return undefined;
  }

  const hasJsxReturn = collectReturnedExpressions(renderFunction).some(
    (expression) => {
      return expressionContainsJsx(expression);
    },
  );
  if (!hasJsxReturn) {
    return undefined;
  }

  return {
    declaration,
    name,
    propsParameter: renderFunction.parameters[0],
    renderFunction,
  };
}

function getSymbol(
  node: ts.Node,
  checker: ts.TypeChecker,
): ts.Symbol | undefined {
  const symbol = checker.getSymbolAtLocation(node);
  if (symbol == null) {
    return undefined;
  }
  // TypeScript exposes alias state through symbol bit flags.
  // eslint-disable-next-line sonarjs/bitwise-operators
  if ((symbol.flags & ts.SymbolFlags.Alias) !== 0) {
    return checker.getAliasedSymbol(symbol);
  }
  return symbol;
}

function getPropertyNameText(
  name: ts.BindingName | ts.PropertyName,
): string | undefined {
  if (ts.isIdentifier(name)) {
    return name.text;
  }
  if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name)) {
    return undefined;
  }
  return undefined;
}

function addBindingIdentifierSymbols(
  name: ts.BindingName,
  checker: ts.TypeChecker,
  destination: Set<ts.Symbol>,
) {
  if (ts.isIdentifier(name)) {
    const symbol = getSymbol(name, checker);
    if (symbol != null) {
      destination.add(symbol);
    }
    return;
  }

  for (const element of name.elements) {
    if (ts.isOmittedExpression(element)) {
      continue;
    }
    addBindingIdentifierSymbols(element.name, checker, destination);
  }
}

function typeHasClassNameProperty(
  checker: ts.TypeChecker,
  parameter: ts.ParameterDeclaration,
): boolean {
  const type = checker.getTypeAtLocation(parameter.name);
  const apparentType = checker.getApparentType(type);
  return apparentType.getProperties().some((property) => {
    return property.getName() === "className";
  });
}

function hasClassNameBinding(parameter: ts.ParameterDeclaration): boolean {
  if (!ts.isObjectBindingPattern(parameter.name)) {
    return false;
  }

  return parameter.name.elements.some((element) => {
    if (ts.isOmittedExpression(element)) {
      return false;
    }
    const propertyName = getPropertyNameText(
      element.propertyName ?? element.name,
    );
    return propertyName === "className";
  });
}

function createStyleInspector(
  checker: ts.TypeChecker,
  component: ComponentDefinition,
): {
  hasInternalStyle: () => boolean;
  isClassNamePropExpression: (expression: ts.Expression) => boolean;
} {
  const classNameSymbols = new Set<ts.Symbol>();
  const propsObjectSymbols = new Set<ts.Symbol>();
  const expressionCache = new Map<ts.Node, StyleClassification>();

  if (component.propsParameter != null) {
    if (ts.isIdentifier(component.propsParameter.name)) {
      const symbol = getSymbol(component.propsParameter.name, checker);
      if (symbol != null) {
        propsObjectSymbols.add(symbol);
      }
    }

    if (ts.isObjectBindingPattern(component.propsParameter.name)) {
      for (const element of component.propsParameter.name.elements) {
        if (element.dotDotDotToken != null) {
          addBindingIdentifierSymbols(
            element.name,
            checker,
            propsObjectSymbols,
          );
          continue;
        }

        const propertyName = getPropertyNameText(
          element.propertyName ?? element.name,
        );
        if (propertyName === "className") {
          addBindingIdentifierSymbols(element.name, checker, classNameSymbols);
        }
      }
    }
  }

  function isPropsObjectExpression(
    expression: ts.Expression,
    visited = new Set<ts.Node>(),
  ): boolean {
    const unwrapped = unwrapExpression(expression);
    if (visited.has(unwrapped)) {
      return false;
    }
    visited.add(unwrapped);

    if (ts.isIdentifier(unwrapped)) {
      const symbol = getSymbol(unwrapped, checker);
      if (symbol == null) {
        return false;
      }
      if (propsObjectSymbols.has(symbol)) {
        return true;
      }

      const declaration = symbol.valueDeclaration;
      if (
        declaration != null &&
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer != null
      ) {
        return isPropsObjectExpression(declaration.initializer, visited);
      }
    }

    return false;
  }

  const { body } = component.renderFunction;
  if (body != null) {
    visitNode(
      body,
      (current) => {
        if (!ts.isVariableDeclaration(current) || current.initializer == null) {
          return;
        }

        if (ts.isIdentifier(current.name)) {
          if (isPropsObjectExpression(current.initializer)) {
            const symbol = getSymbol(current.name, checker);
            if (symbol != null) {
              propsObjectSymbols.add(symbol);
            }
          }
          return;
        }

        if (
          ts.isObjectBindingPattern(current.name) &&
          isPropsObjectExpression(current.initializer)
        ) {
          for (const element of current.name.elements) {
            if (element.dotDotDotToken != null) {
              addBindingIdentifierSymbols(
                element.name,
                checker,
                propsObjectSymbols,
              );
              continue;
            }

            const propertyName = getPropertyNameText(
              element.propertyName ?? element.name,
            );
            if (propertyName === "className") {
              addBindingIdentifierSymbols(
                element.name,
                checker,
                classNameSymbols,
              );
            }
          }
        }
      },
      { skipNestedFunctions: true },
    );
  }

  function combineClassifications(
    values: Array<StyleClassification>,
  ): StyleClassification {
    if (values.includes("internal")) {
      return "internal";
    }
    if (values.length > 0 && values.every((value) => value === "passthrough")) {
      return "passthrough";
    }
    return "unknown";
  }

  function isClassNamePropExpression(
    expression: ts.Expression,
    visited = new Set<ts.Node>(),
  ): boolean {
    const unwrapped = unwrapExpression(expression);
    if (visited.has(unwrapped)) {
      return false;
    }
    visited.add(unwrapped);

    if (ts.isIdentifier(unwrapped)) {
      const symbol = getSymbol(unwrapped, checker);
      if (symbol == null) {
        return false;
      }
      if (classNameSymbols.has(symbol)) {
        return true;
      }

      const declaration = symbol.valueDeclaration;
      return (
        declaration != null &&
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer != null &&
        isClassNamePropExpression(declaration.initializer, visited)
      );
    }

    if (ts.isPropertyAccessExpression(unwrapped)) {
      return (
        unwrapped.name.text === "className" &&
        isPropsObjectExpression(unwrapped.expression)
      );
    }

    return (
      ts.isElementAccessExpression(unwrapped) &&
      ts.isStringLiteral(unwrapped.argumentExpression) &&
      unwrapped.argumentExpression.text === "className" &&
      isPropsObjectExpression(unwrapped.expression)
    );
  }

  function classifyExpression(expression: ts.Expression): StyleClassification {
    const unwrapped = unwrapExpression(expression);
    const cached = expressionCache.get(unwrapped);
    if (cached != null) {
      return cached;
    }

    expressionCache.set(unwrapped, "unknown");

    let result: StyleClassification = "unknown";

    if (
      ts.isStringLiteral(unwrapped) ||
      ts.isNoSubstitutionTemplateLiteral(unwrapped)
    ) {
      result = isInternalLiteralText(unwrapped.text) ? "internal" : "unknown";
    } else if (ts.isTemplateExpression(unwrapped)) {
      const parts = [
        unwrapped.head.text,
        ...unwrapped.templateSpans.map((span) => span.literal.text),
      ];
      result = parts.some((part) => isInternalLiteralText(part))
        ? "internal"
        : combineClassifications(
            unwrapped.templateSpans.map((span) =>
              classifyExpression(span.expression),
            ),
          );
    } else if (ts.isIdentifier(unwrapped)) {
      if (isClassNamePropExpression(unwrapped)) {
        result = "passthrough";
      } else {
        const symbol = getSymbol(unwrapped, checker);
        if (
          symbol?.valueDeclaration != null &&
          ts.isVariableDeclaration(symbol.valueDeclaration) &&
          symbol.valueDeclaration.initializer != null
        ) {
          result = classifyExpression(symbol.valueDeclaration.initializer);
        }
      }
    } else if (ts.isPropertyAccessExpression(unwrapped)) {
      result = isClassNamePropExpression(unwrapped) ? "passthrough" : "unknown";
    } else if (ts.isElementAccessExpression(unwrapped)) {
      result = isClassNamePropExpression(unwrapped) ? "passthrough" : "unknown";
    } else if (ts.isCallExpression(unwrapped)) {
      const calleeName = getCallLikeName(unwrapped.expression);
      if (
        calleeName === "cva" ||
        classifyExpression(unwrapped.expression) === "internal"
      ) {
        result = "internal";
      } else if (isClassNameHelperName(calleeName)) {
        result = combineClassifications(
          unwrapped.arguments.map((argument) => classifyExpression(argument)),
        );
      }
    } else if (ts.isConditionalExpression(unwrapped)) {
      result = combineClassifications([
        classifyExpression(unwrapped.whenTrue),
        classifyExpression(unwrapped.whenFalse),
      ]);
    } else if (
      ts.isBinaryExpression(unwrapped) &&
      (unwrapped.operatorToken.kind === ts.SyntaxKind.PlusToken ||
        unwrapped.operatorToken.kind ===
          ts.SyntaxKind.AmpersandAmpersandToken ||
        unwrapped.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        unwrapped.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    ) {
      result = combineClassifications([
        classifyExpression(unwrapped.left),
        classifyExpression(unwrapped.right),
      ]);
    } else if (ts.isArrayLiteralExpression(unwrapped)) {
      result = combineClassifications(
        unwrapped.elements
          .filter((element): element is ts.Expression =>
            ts.isExpression(element),
          )
          .map((element) => classifyExpression(element)),
      );
    }
    expressionCache.set(unwrapped, result);
    return result;
  }

  function attributeHasInternalStyle(attribute: ts.JsxAttribute): boolean {
    const { initializer } = attribute;
    if (initializer == null) {
      return false;
    }
    if (
      ts.isStringLiteral(initializer) ||
      ts.isNoSubstitutionTemplateLiteral(initializer)
    ) {
      return isInternalLiteralText(initializer.text);
    }
    if (!ts.isJsxExpression(initializer) || initializer.expression == null) {
      return false;
    }
    return classifyExpression(initializer.expression) === "internal";
  }

  function hasInternalStyle(): boolean {
    return collectReturnedExpressions(component.renderFunction).some(
      (expression) => {
        let found = false;
        visitNode(expression, (current) => {
          if (
            ts.isJsxAttribute(current) &&
            ts.isIdentifier(current.name) &&
            current.name.text === "className" &&
            attributeHasInternalStyle(current)
          ) {
            found = true;
          }
        });
        return found;
      },
    );
  }

  return {
    hasInternalStyle,
    isClassNamePropExpression,
  };
}

export function createComponentAnalyzer(
  context: Readonly<RuleContext<string, ReadonlyArray<unknown>>>,
) {
  const services = ESLintUtils.getParserServices(context);
  const checker = services.program.getTypeChecker();
  const stateCache = new Map<
    ts.Declaration,
    | {
        analysis: ComponentAnalysis;
        styleInspector: ReturnType<typeof createStyleInspector>;
      }
    | undefined
  >();

  function getComponentState(declaration: ts.Declaration):
    | {
        analysis: ComponentAnalysis;
        styleInspector: ReturnType<typeof createStyleInspector>;
      }
    | undefined {
    if (stateCache.has(declaration)) {
      return stateCache.get(declaration);
    }

    const component = getComponentDefinition(declaration);
    if (component == null) {
      stateCache.set(declaration, undefined);
      return undefined;
    }

    const styleInspector = createStyleInspector(checker, component);
    const analysis: ComponentAnalysis = {
      ...component,
      exposesClassNameProp:
        component.propsParameter != null &&
        (hasClassNameBinding(component.propsParameter) ||
          typeHasClassNameProperty(checker, component.propsParameter)),
      hasInternalStyle: styleInspector.hasInternalStyle(),
    };

    const state = {
      analysis,
      styleInspector,
    };
    stateCache.set(declaration, state);
    return state;
  }

  function analyzeDeclaration(
    declaration: ts.Declaration,
  ): ComponentAnalysis | undefined {
    return getComponentState(declaration)?.analysis;
  }

  function getStateForRenderFunction(
    renderFunction:
      | ts.ArrowFunction
      | ts.FunctionDeclaration
      | ts.FunctionExpression,
  ):
    | {
        analysis: ComponentAnalysis;
        styleInspector: ReturnType<typeof createStyleInspector>;
      }
    | undefined {
    if (ts.isFunctionDeclaration(renderFunction)) {
      return getComponentState(renderFunction);
    }

    let current: ts.Node = renderFunction;
    while (current.parent != null) {
      const {parent} = current;
      if (
        ts.isAsExpression(parent) ||
        ts.isParenthesizedExpression(parent) ||
        ts.isSatisfiesExpression(parent) ||
        ts.isTypeAssertionExpression(parent) ||
        ts.isNonNullExpression(parent)
      ) {
        current = parent;
        continue;
      }

      if (ts.isCallExpression(parent) && parent.arguments[0] === current) {
        const calleeName = getCallLikeName(parent.expression);
        if (calleeName === "forwardRef" || calleeName === "memo") {
          current = parent;
          continue;
        }
      }

      if (ts.isVariableDeclaration(parent)) {
        const state = getComponentState(parent);
        return state?.analysis.renderFunction === renderFunction
          ? state
          : undefined;
      }

      return undefined;
    }

    return undefined;
  }

  function getOwningComponentState(node: ts.Node):
    | {
        analysis: ComponentAnalysis;
        styleInspector: ReturnType<typeof createStyleInspector>;
      }
    | undefined {
    let current: ts.Node | undefined = node;

    while (current != null) {
      if (ts.isVariableDeclaration(current)) {
        const state = getComponentState(current);
        if (state != null) {
          return state;
        }
      }

      if (
        ts.isFunctionDeclaration(current) ||
        ts.isArrowFunction(current) ||
        ts.isFunctionExpression(current)
      ) {
        return getStateForRenderFunction(current);
      }

      current = current.parent;
    }

    return undefined;
  }

  function analyzeJsxOpeningElement(
    node: TSESTree.JSXOpeningElement,
  ): ComponentAnalysis | undefined {
    const tsNode = services.esTreeNodeToTSNodeMap.get(node.name);
    const symbol = getSymbol(tsNode, checker);
    if (symbol == null) {
      return undefined;
    }

    for (const declaration of symbol.declarations ?? []) {
      const analysis = analyzeDeclaration(declaration);
      if (analysis != null) {
        return analysis;
      }
    }

    return undefined;
  }

  function getCurrentFileAnalysis(
    node: TSESTree.Node,
  ): ComponentAnalysis | undefined {
    const tsNode = services.esTreeNodeToTSNodeMap.get(node);
    if (ts.isFunctionDeclaration(tsNode) || ts.isVariableDeclaration(tsNode)) {
      return analyzeDeclaration(tsNode);
    }
    return undefined;
  }

  function getEnclosingComponentAnalysis(
    node: TSESTree.Node,
  ): ComponentAnalysis | undefined {
    const tsNode = services.esTreeNodeToTSNodeMap.get(node);
    return getOwningComponentState(tsNode)?.analysis;
  }

  function isClassNamePropExpression(
    node: TSESTree.Expression,
    componentAnalysis: ComponentAnalysis,
  ): boolean {
    const tsNode = services.esTreeNodeToTSNodeMap.get(node);
    if (!ts.isExpression(tsNode)) {
      return false;
    }

    return (
      getComponentState(
        componentAnalysis.declaration,
      )?.styleInspector.isClassNamePropExpression(tsNode) ?? false
    );
  }

  return {
    analyzeJsxOpeningElement,
    checker,
    getEnclosingComponentAnalysis,
    getCurrentFileAnalysis,
    isClassNamePropExpression,
    services,
  };
}
