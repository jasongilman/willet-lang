const astHelper = require('./ast-helper');
const {
  dsl, nodeType, isListLiteral, isBlock, isAnnotatedNode, isInfixExpression
} = astHelper;
const {
  hasKey
} = require('./ast');

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
      return dsl.funcArg(n.get('left'), n.get('right'));
    }
    return dsl.funcArg(n);
  });

  const block = node.get('right');
  if (!isBlock(block)) {
    throw new Error(`Expected block ${nodeType(block)}`);
  }
  return dsl.func(funcArgs, block).set('annotation', fnAnnotation);
};

const typeToVisitor = {
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
  }
};

const parse = (ast) => astHelper.postwalk({}, (context, node) => {
  const visitor = typeToVisitor[nodeType(node)];
  if (visitor) {
    node = visitor(node);
  }
  return node;
}, ast);

module.exports = {
  parse
};

// const fs = require('fs');
// code = fs.readFileSync('../tests/examples/full_semantic_parser_example.wlt').toString()
// const parser = require('./chevrotain-parser');
// ast = parser.parse(code)
//
//
// console.log(JSON.stringify(ast, null, 2));
//
// const getRecordKeys = (rec) => rec.__proto__.constructor.keys;
//
// getRecordKeys(ast)
//
// result = astHelper.prewalk(
//   {},
//   (c, v) => {
//     console.log('-----------------------------------');
//     console.log('v:', v);
//     console.log('-----------------------------------');
//     return v;
//   },
//   ast
// )
//
// result
// result.equals(ast)
