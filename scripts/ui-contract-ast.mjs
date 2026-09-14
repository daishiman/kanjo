import ts from 'typescript';

const lineOf = (sourceFile, node) =>
  sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;

function attribute(opening, name) {
  return opening.attributes.properties.find(
    (property) => ts.isJsxAttribute(property) && property.name.text === name,
  );
}

function literalAttributeValue(value) {
  if (!value) return true;
  if (ts.isStringLiteral(value)) return value.text;
  if (ts.isJsxExpression(value) && value.expression && ts.isStringLiteral(value.expression)) {
    return value.expression.text;
  }
  return undefined;
}

function isDynamicAttribute(opening, name) {
  const found = attribute(opening, name);
  return Boolean(found?.initializer && ts.isJsxExpression(found.initializer) && found.initializer.expression);
}

function ancestorHasSortSemantics(node) {
  let current = node.parent;
  while (current) {
    if (ts.isJsxElement(current)) {
      const opening = current.openingElement;
      if (opening.tagName.getText() === 'th' && attribute(opening, 'aria-sort')) return true;
    }
    current = current.parent;
  }
  return false;
}

export function analyzeInteractiveSource(source, fileName, { exceptionMarkers = [] } = {}) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.TSX,
  );
  const violations = [];
  const sharedButtonImplementation = /(?:^|\/)components\/Button\.tsx$/.test(fileName);

  const inspectOpening = (opening) => {
    const tag = opening.tagName.getText(sourceFile);
    const line = lineOf(sourceFile, opening);
    const role = literalAttributeValue(attribute(opening, 'role')?.initializer);
    if (role === 'button' && tag !== 'Button') {
      violations.push(`${fileName}:${line} role=button bypasses the shared Button`);
    }
    if ((tag === 'div' || tag === 'a') && attribute(opening, 'onClick')) {
      violations.push(`${fileName}:${line} ${tag} with onClick bypasses the shared Button`);
    }
    if (tag === 'input') {
      const type = literalAttributeValue(attribute(opening, 'type')?.initializer);
      if (attribute(opening, 'type') && type === undefined) {
        violations.push(`${fileName}:${line} dynamic input type can bypass the shared Button`);
      }
      if (['submit', 'button', 'reset'].includes(type)) {
        violations.push(`${fileName}:${line} input[type=${type}] bypasses the shared Button`);
      }
    }
    if (tag !== 'button' || sharedButtonImplementation) return;

    const marker = literalAttributeValue(attribute(opening, 'data-native-control')?.initializer);
    if (typeof marker !== 'string' || !exceptionMarkers.includes(marker)) {
      violations.push(`${fileName}:${line} native button is outside the exception taxonomy`);
      return;
    }
    const dynamic = (name) => isDynamicAttribute(opening, name);
    const literal = (name) => literalAttributeValue(attribute(opening, name)?.initializer);
    const valid =
      (marker === 'disclosure' && dynamic('aria-expanded')) ||
      (marker === 'menu-trigger' && dynamic('aria-expanded') && literal('aria-haspopup') === 'menu') ||
      (marker === 'tab' && literal('role') === 'tab' && dynamic('aria-selected')) ||
      (marker === 'toggle' && dynamic('aria-pressed')) ||
      (marker === 'sort' && ancestorHasSortSemantics(opening));
    if (!valid) {
      const detail =
        marker === 'toggle'
          ? 'native toggle marker is not backed by dynamic aria-pressed state'
          : `native ${marker} marker is missing its dynamic ARIA semantics`;
      violations.push(`${fileName}:${line} ${detail}`);
    }
  };

  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) inspectOpening(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}

const CHART_COLOR_PROPERTIES = new Set([
  'backgroundColor',
  'borderColor',
  'pointBackgroundColor',
  'pointBorderColor',
  'hoverBackgroundColor',
  'hoverBorderColor',
]);

const RAW_COLOR = /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl|hwb|lab|lch|oklab|oklch|color)\()/i;

function propertyName(node) {
  if (!node.name) return null;
  if (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) return node.name.text;
  return null;
}

function containsDecorativeFill(node) {
  let found = false;
  const visit = (current) => {
    if (
      ts.isCallExpression(current) &&
      (ts.isIdentifier(current.expression) || ts.isPropertyAccessExpression(current.expression)) &&
      current.expression.getText().endsWith('chartDecorativeFill')
    ) {
      found = true;
    }
    if (!found) ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function hasRawColor(node) {
  let found = false;
  const visit = (current) => {
    if (
      (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) &&
      RAW_COLOR.test(current.text)
    ) {
      found = true;
    }
    if (!found) ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

function colorBindings(sourceFile) {
  const bindings = new Map();
  const pushes = new Map();
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const existing = bindings.get(node.name.text) ?? [];
      existing.push({ initializer: node.initializer, writes: [] });
      bindings.set(node.name.text, existing);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'push' &&
      ts.isIdentifier(node.expression.expression)
    ) {
      const name = node.expression.expression.text;
      pushes.set(name, [...(pushes.get(name) ?? []), ...node.arguments]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  for (const [name, writes] of pushes) {
    for (const binding of bindings.get(name) ?? []) binding.writes.push(...writes);
  }
  return bindings;
}

function isNestedFunction(node) {
  return (
    ts.isArrowFunction(node) ||
    ts.isFunctionExpression(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node)
  );
}

function callbackReturns(callback) {
  if (!ts.isBlock(callback.body)) return [callback.body];
  const returns = [];
  const visit = (node) => {
    if (node !== callback.body && isNestedFunction(node)) return;
    if (ts.isReturnStatement(node)) {
      returns.push(node.expression ?? null);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(callback.body);
  return returns;
}

function createColorProvenance(sourceFile) {
  const bindings = colorBindings(sourceFile);
  const activeBindings = new Set();

  const approved = (node) => {
    if (!node) return false;
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isSatisfiesExpression?.(node)
    ) {
      return approved(node.expression);
    }
    if (ts.isPropertyAccessExpression(node)) {
      return ts.isIdentifier(node.expression) && node.expression.text === 'COLORS';
    }
    if (ts.isElementAccessExpression(node)) return approved(node.expression);
    if (ts.isIdentifier(node)) {
      const candidates = bindings.get(node.text);
      if (!candidates?.length) return false;
      return candidates.every((binding) => {
        if (activeBindings.has(binding) || !binding.initializer) return false;
        activeBindings.add(binding);
        const emptySeed =
          ts.isArrayLiteralExpression(binding.initializer) && binding.initializer.elements.length === 0;
        const seedApproved = emptySeed ? binding.writes.length > 0 : approved(binding.initializer);
        const writesApproved = binding.writes.every(approved);
        activeBindings.delete(binding);
        return seedApproved && writesApproved;
      });
    }
    if (ts.isArrayLiteralExpression(node)) {
      return node.elements.length > 0 && node.elements.every((element) => approved(element));
    }
    if (ts.isSpreadElement(node)) return approved(node.expression);
    if (ts.isConditionalExpression(node)) return approved(node.whenTrue) && approved(node.whenFalse);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) {
      return approved(node.left) && approved(node.right);
    }
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression)) {
        if (node.expression.text === 'chartSeriesColor') return true;
        if (node.expression.text === 'vendorPalette') return true;
        if (node.expression.text === 'chartDecorativeFill') return approved(node.arguments[0]);
      }
      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'map') {
        const callback = node.arguments[0];
        if (!callback || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))) return false;
        const returns = callbackReturns(callback);
        return returns.length > 0 && returns.every(approved);
      }
    }
    return false;
  };
  return approved;
}

export function analyzeChartColorSource(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.jsx') ? ts.ScriptKind.JSX : ts.ScriptKind.TSX,
  );
  const violations = [];
  const isApprovedColorExpression = createColorProvenance(sourceFile);
  const visit = (node) => {
    if (ts.isPropertyAssignment(node)) {
      const name = propertyName(node);
      if (name && CHART_COLOR_PROPERTIES.has(name)) {
        const line = lineOf(sourceFile, node);
        if (hasRawColor(node.initializer)) {
          violations.push(`${fileName}:${line} ${name} is not derived from a semantic chart role`);
        } else if (
          (name === 'borderColor' || name === 'pointBorderColor') &&
          containsDecorativeFill(node.initializer)
        ) {
          violations.push(`${fileName}:${line} ${name} cannot use a decorative fill`);
        } else if (!isApprovedColorExpression(node.initializer)) {
          violations.push(`${fileName}:${line} ${name} is not derived from an approved semantic chart role`);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return violations;
}
