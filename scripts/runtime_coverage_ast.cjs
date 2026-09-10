// Parse declarations without importing or executing game/test code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const request = JSON.parse(fs.readFileSync(0, 'utf8'));
const ts = require(require.resolve('typescript', {paths: [request.root, process.cwd()]}));
const result = {};
for (const relative of request.paths) {
  const file = path.resolve(request.root, relative);
  if (!fs.existsSync(file)) { result[relative] = {error: 'missing file'}; continue; }
  const content = fs.readFileSync(file, 'utf8');
  const program = ts.createProgram([file], {noResolve: true, noLib: true, allowJs: true});
  const source = program.getSourceFile(file);
  const checker = program.getTypeChecker();
  const references = new Map();
  const functions = [], tests = [];
  const title = node => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) ? node.getText(source).slice(1, -1) : null;
  function value(node, seen = new Set()) {
    if (!node) return undefined;
    if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression(node)) return value(node.expression, seen);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {const v = value(node.operand, seen); return typeof v === 'number' ? -v : undefined;}
    if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node);
      const declaration = symbol?.valueDeclaration;
      if (!symbol || seen.has(symbol) || !declaration || !ts.isVariableDeclaration(declaration)
          || !(declaration.parent.flags & ts.NodeFlags.Const) || declaration.getStart(source) >= node.getStart(source)) return undefined;
      let initializer = declaration.initializer;
      while (initializer && (ts.isAsExpression(initializer) || ts.isParenthesizedExpression(initializer) || ts.isSatisfiesExpression(initializer))) initializer=initializer.expression;
      const primitive = initializer && (ts.isStringLiteral(initializer) || ts.isNumericLiteral(initializer)
        || ts.isNoSubstitutionTemplateLiteral(initializer) || [ts.SyntaxKind.TrueKeyword,ts.SyntaxKind.FalseKeyword,ts.SyntaxKind.NullKeyword].includes(initializer.kind));
      // Composite values must never escape to arbitrary calls, aliases or property
      // accesses. Unknown use fails closed, even if it might be a harmless read.
      if (!primitive) {
        if (declaration.parent.parent.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) return undefined;
        for (const reference of references.get(symbol) || []) {
          if (reference === declaration.name) continue;
          let use=reference;
          while (ts.isAsExpression(use.parent) || ts.isParenthesizedExpression(use.parent) || ts.isSatisfiesExpression(use.parent)) use=use.parent;
          const parent=use.parent;
          if (!(ts.isCallExpression(parent) && parent.arguments[0] === use && ts.isPropertyAccessExpression(parent.expression) && parent.expression.name.text === 'each')) return undefined;
        }
      }
      return value(declaration.initializer, new Set([...seen,symbol]));
    }
    if (ts.isArrayLiteralExpression(node)) {const a = node.elements.map(n => value(n, seen)); return a.includes(undefined) ? undefined : a;}
    if (ts.isObjectLiteralExpression(node)) {const o = {}; for (const p of node.properties) {if (!ts.isPropertyAssignment(p)) return undefined; const v=value(p.initializer,seen); if(v===undefined)return undefined; o[p.name.text]=v;} return o;}
    return undefined;
  }
  function collect(node) { if(ts.isIdentifier(node)) {const symbol=checker.getSymbolAtLocation(node); if(symbol) {if(!references.has(symbol))references.set(symbol,[]);references.get(symbol).push(node);}} ts.forEachChild(node,collect); }
  collect(source);
  function walk(node, suites = [], disabled = false) {
    if (ts.isFunctionDeclaration(node) && node.name && node.body) functions.push(node.name.text);
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer)||ts.isFunctionExpression(node.initializer))) functions.push(node.name.text);
    let childSuites = suites, childDisabled = disabled;
    if (ts.isCallExpression(node)) {
      let call = node.expression, each = false, parameters = null;
      if (ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === 'each') {
        each=true; parameters=value(call.arguments[0]) ?? null; call=call.expression.expression;
      }
      while (ts.isPropertyAccessExpression(call) && ['only','skip','todo','concurrent'].includes(call.name.text)) {
        if(['skip','todo'].includes(call.name.text)) childDisabled=true;
        call=call.expression;
      }
      const name = ts.isIdentifier(call) ? call.text : '';
      if (['it','test','describe'].includes(name) && title(node.arguments[0]) !== null) {
        const t=title(node.arguments[0]);
        if(name==='describe') childSuites=[...suites,t];
        else if (node.arguments.slice(1).some(a=>ts.isArrowFunction(a)||ts.isFunctionExpression(a))) tests.push({title:t,suite:suites,line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1, each, parameters, disabled:childDisabled,
          declarationSha256:crypto.createHash('sha256').update(node.getText(source)).digest('hex')});
      }
    }
    ts.forEachChild(node, n=>walk(n,childSuites,childDisabled));
  }
  walk(source);
  result[relative]={functions:[...new Set(functions)],tests};
}
process.stdout.write(JSON.stringify(result));
