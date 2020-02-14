const Immutable = require('immutable');
const { List } = Immutable;
const astHelper = require('./ast-helper');
const {
  dsl, nodeType, isListLiteral, isBlock, isAnnotatedNode, isInfixExpression,
  isValueSequence, isReference, isFunctionCall, isMapLiteral, isArrayLiteral
} = astHelper;
const {
  hasKey
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
  if (isAnnotatedNode(listOfArgs)) {
    fnAnnotation = listOfArgs.get('annotation');
    listOfArgs = listOfArgs.get('node');
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
  return dsl.func(funcArgs, block).set('annotation', fnAnnotation);
};

const extractIfNode = (node, symbol = 'if$wlt', dslFunc = dsl.ifNode) => {
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

const extractElseIfNode = (node) => extractIfNode(node, 'elseif', dsl.elseIfNode);

const extractElseNode = (node) => {
  let newNode = null;
  if (isValueSequence(node) && node.get('values').count() === 2) {
    const [ref, funcCall] = node.get('values');
    if (isReference(ref) && ref.get('symbol') === 'else$wlt' && isFunctionCall(funcCall)) {
      newNode = dsl.elseNode(funcCall.get('block'));
    }
  }
  return newNode;
};

const handleIfInStatements = (statements) => {
  let currIfList = null;
  let result = statements.reduce((newStmts, stmt) => {
    if (currIfList) {
      const ifNode = extractIfNode(stmt);
      const elseIf = extractElseIfNode(stmt);
      const elseNode = extractElseNode(stmt);

      if (ifNode) {
        newStmts = newStmts.push(currIfList);
        currIfList = dsl.ifList(ifNode);
      }
      else if (elseIf) {
        currIfList = currIfList.update('items', (items) => items.push(elseIf));
      }
      else if (elseNode) {
        currIfList = currIfList.update('items', (items) => items.push(elseNode));
        newStmts = newStmts.push(currIfList);
        currIfList = null;
      }
      else {
        // Another kind of statement.
        newStmts = newStmts.push(currIfList);
        currIfList = null;
      }
    }
    else {
      const ifNode = extractIfNode(stmt);

      if (ifNode) {
        currIfList = dsl.ifList(ifNode);
      }
      else {
        newStmts = newStmts.push(stmt);
      }
    }
    return newStmts;
  }, List());
  if (currIfList) {
    result = result.push(currIfList);
  }
  return result;
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
  Program: (node) => node.update('statements', handleIfInStatements),
  Block: (node) => node.update('statements', handleIfInStatements)
};

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
