const Immutable = require('immutable');
const { List } = Immutable;
const astHelper = require('./ast-helper');
const {
  dsl, nodeType, isListLiteral, isBlock, isAnnotatedNode, isInfixExpression,
  isValueSequence, isReference, isFunctionCall, isMapLiteral, isArrayLiteral
} = astHelper;
const {
  hasKey, l2
} = require('./ast');

const convertToDestructure = (assigningNode) => astHelper.postwalk(
  {},
  (context, node) => {
    if (isMapLiteral(node)) {
      node = dsl.mapDestructuring(...node.get('properties'));
    }
    else if (isArrayLiteral(node)) {
      node = dsl.arrayDestructuring(...node.get('values'));
    }
    return node;
  },
  assigningNode
);

const infixToFunction = (node) => {
  let fnAnnotation;
  let listOfArgs = node.get('left');
  let async = false;
  if (isAnnotatedNode(listOfArgs)) {
    fnAnnotation = listOfArgs.get('annotation');
    listOfArgs = listOfArgs.get('node');
    async = fnAnnotation.get('properties')
      .filter((p) => p.get('key') === 'async')
      .getIn([0, 'value', 'value'], false);
  }

  if (!isListLiteral(listOfArgs)) {
    throw new Error(`Expected list node ${nodeType(listOfArgs)}`);
  }
  const argNodes = listOfArgs.get('values');

  const funcArgs = argNodes.map((n) => {
    if (isInfixExpression(n)) {
      // This is a function argument with a default value.
      return dsl.funcArg(convertToDestructure(n.get('left')), n.get('right'));
    }
    return dsl.funcArg(convertToDestructure(n));
  });

  let block = node.get('right');
  if (!isBlock(block)) {
    block = dsl.block(block);
  }
  return dsl.func(funcArgs, block, async).set('annotation', fnAnnotation);
};

const extractSpecialFuncCall = (node, symbol, dslFunc) => {
  let newNode = null;
  if (isValueSequence(node) && node.get('values').count() === 2) {
    const [ref, funcCall] = node.get('values');
    if (isReference(ref) && ref.get('symbol') === symbol && isFunctionCall(funcCall)) {
      const [cond] = funcCall.get('args');
      newNode = dslFunc(cond, funcCall.get('block'));
    }
  }
  return newNode;
};

const extractIfNode = (node) => extractSpecialFuncCall(node, 'if$wlt', dsl.ifNode);

const extractElseIfNode = (node) => extractSpecialFuncCall(node, 'elseif', dsl.elseIfNode);

const extractElseNode = (node) =>
  extractSpecialFuncCall(node, 'else$wlt', (arg, block) => dsl.elseNode(block));

const extractIfList = (ifNode, i, statements) => {
  let done = false;
  const ifListNodes = [ifNode];
  while (!done && i < statements.count()) {
    const elseIfNode = extractElseIfNode(statements.get(i));
    if (elseIfNode) {
      ifListNodes.push(elseIfNode);
      i += 1;
    }
    else {
      done = true;
    }
  }
  if (i < statements.count()) {
    const elseNode = extractElseNode(statements.get(i));
    if (elseNode) {
      ifListNodes.push(elseNode);
      i += 1;
    }
  }
  return [i, dsl.ifList(...ifListNodes)];
};

const extractTryBlock = (node) => extractSpecialFuncCall(node, 'try$wlt', (arg, block) => block);

const extractCatchArgAndBlock = (node) =>
  extractSpecialFuncCall(node, 'catch$wlt', (arg, block) => [arg, block]);

const extractFinallyBlock = (node) =>
  extractSpecialFuncCall(node, 'finally$wlt', (arg, block) => block);

const extractTryCatch = (tryBlock, i, statements) => {
  // FUTURE validate all the parts of try
  const [catchArg, catchBlock] = extractCatchArgAndBlock(statements.get(i));
  i += 1;
  const finallyBlock = extractFinallyBlock(statements.get(i));
  if (finallyBlock) {
    i += 1;
  }
  return [i, dsl.tryCatch(tryBlock, catchArg, catchBlock, finallyBlock)];
};

// Merges things like if/else and try/catch that are parsed as multiple statements into a single
// statement.
const combineMultiStatementForms = (nodes) => {
  const newNodes = [];
  for (let i = 0; i < nodes.count(); i += 1) {
    const stmt = nodes.get(i);
    const ifNode = extractIfNode(stmt);
    if (ifNode) {
      i += 1;
      const [newI, ifList] = extractIfList(ifNode, i, nodes);
      newNodes.push(ifList);
      i = newI - 1; // subtract 1 because we'll increment next
    }
    else {
      const tryBlock = extractTryBlock(stmt);
      if (tryBlock) {
        i += 1;
        const [newI, tryCatch] = extractTryCatch(tryBlock, i, nodes);
        newNodes.push(tryCatch);
        i = newI - 1; // subtract 1 because we'll increment next
      }
      else {
        newNodes.push(stmt);
      }
    }
  }
  return List(newNodes);
};

const handleQuoteUnquote = (node) => {
  if (isValueSequence(node) && node.get('values').count() === 2) {
    const [ref, funcCall] = node.get('values');
    if (isReference(ref) && isFunctionCall(funcCall)) {
      if (ref.get('symbol') === 'quote') {
        node = l2.Quote({
          args: funcCall.get('args'),
          block: dsl.soloBlock(funcCall.get('block'))
        });
      }
      else if (ref.get('symbol') === 'unquote') {
        node = l2.Unquote({
          args: funcCall.get('args'),
          block: dsl.soloBlock(funcCall.get('block'))
        });
      }
    }
  }
  return node;
};

const typeToVisitor = {
  Def: (node) => node.update('target', convertToDestructure),
  InfixExpression: (node) => {
    if (node.get('operator') === '=>') {
      node = infixToFunction(node);
    }
    return node;
  },
  AnnotatedNode: (node) => {
    const annotation = node.get('annotation');
    const innerNode = node.get('node');
    if (hasKey(innerNode, 'annotation')) {
      node = innerNode.set('annotation', annotation);
    }
    return node;
  },
  ValueSequence: handleQuoteUnquote,
  ArrayLiteral: (node) => node.update('values', combineMultiStatementForms),
  SetLiteral: (node) => node.update('values', combineMultiStatementForms),
  ListLiteral: (node) => node.update('values', combineMultiStatementForms),
  FunctionCall: (node) => node.update('args', combineMultiStatementForms),
  Program: (node) => node.update('statements', combineMultiStatementForms),
  Block: (node) => node.update('statements', combineMultiStatementForms)
};

// FUTURE after parse is done walk through the code to look for references to if$wlt or else$wlt
// These will be bad usages of if else block. They need to be wrapped in parens in certain
// situations.

const parse = (ast) => astHelper.postwalk(
  { assignment: false },
  (context, node) => {
    const visitor = typeToVisitor[nodeType(node)];
    if (visitor) {
      node = visitor(node);
    }
    return node;
  },
  ast
);

module.exports = {
  parse
};

// code = `
// if (cappa > 45) {
//   alpha
// }
// else if (cappa < 45) {
//   beta
// }
// else {
//   cappa
// }`
// const parser = require('./chevrotain-parser');
// ast = parser.parse(code)
//
//
// ast2 = parse(ast)
//
// ast2
//
// extractIfNode(ast.getIn(['statements', 0]))
//
// console.log(JSON.stringify(ast.getIn(['statements', 0]), null, 2));
