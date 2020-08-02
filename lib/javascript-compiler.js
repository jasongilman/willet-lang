/* eslint-disable prefer-template */
const _ = require('lodash');
const beautify = require('js-beautify').js;
const Immutable = require('immutable');
const { List, Record } = Immutable;
const astHelper = require('./ast-helper');
const {
  dsl, isReference, isFunctionCall, isUnaryExpression, isFunction, isUnquote, isDef
} = astHelper;

const isThrowUnary = (node) =>
  isUnaryExpression(node) && node.get('operator') === 'throw';

const nonSoloBlock = (blok) => (blok && blok.set ? blok.set('solo', false) : blok);

let compileNodeRaw;

const compileNode = (context, node) => {
  try {
    return compileNodeRaw(context, node);
  }
  catch (error) {
    if (!error._logged) {
      console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
      console.log(`node during error: ${JSON.stringify(node, null, 2)}`);
      console.log(error);
      error._logged = true;
    }
    throw error;
  }
};

const compileStatements = (context, statements) => statements
  .map(_.partial(compileNode, context))
  .map((s) => `${s};`)
  .join('\n');

const compileAndJoin = (context, nodes, join = ', ') =>
  nodes.map(_.partial(compileNode, context)).join(join);

const wrapParens = (value) => `(${value})`;
const wrapCurly = (value) => `{${value}}`;
const wrapSquare = (value) => `[${value}]`;

const quoter = (value) => {
  let node;
  if (List.isList(value)) {
    node = dsl.array(...value.map(quoter));
  }
  else if (Immutable.isKeyed(value) || Record.isRecord(value)) {
    if (isUnquote(value)) {
      node = value;
    }
    else {
      const seq = Record.isRecord(value) ? value.toSeq().entrySeq() : value.entrySeq();
      const properties = seq.map(([k, v]) => dsl.property(k, quoter(v)));
      node = dsl.map(...properties);
    }
  }
  else {
    node = dsl.literal(value);
  }
  return node;
};

const wrapWithAnonymousFunction = (context, code) => {
  if (context.async) {
    code = `await (async () => {${code}})()`;
  }
  else {
    code = `(() => {${code}})()`;
  }
  return code;
};

// Maps willet infix operators to equivalent in javascript.
const infixOperatorMap = {
  '==': '===',
  '!=': '!=='
};

const handleJSSpecialKeywordOperatorValueSeq = (context, node) => {
  let code = '';
  const values = node.get('values');
  let remainingValues = values;
  if (isReference(values.get(0))
      && values.getIn([0, 'symbol'])
      && isFunctionCall(values.get(1))) {
    const symbol = values.getIn([0, 'symbol']);
    switch (symbol) {
    case 'staticjs':
      code = values.getIn([1, 'args', 0, 'value']);
      remainingValues = _.drop(values, 2);
      break;
    case 'instanceof':
      const instance = compileNode(context, values.getIn([1, 'args', 0]));
      const type = compileNode(context, values.getIn([1, 'args', 1]));
      code = `(${instance} instanceof ${type})`;
      remainingValues = _.drop(values, 2);
      break;
    default:
        // code will be null and default value sequence will be processed
    }
  }
  return [code, remainingValues];
};

const getVarDeclaration = (context, varType = 'let') => {
  if (context.useBlockScopedVars) {
    return varType;
  }
  return 'var';
};

const typeToConverter = {
  Program: (context, node) => compileStatements(context, node.get('statements')),
  AnnotatedNode: (context, node) => compileNode(context, node.get('node')),
  Block: (context, node) => {
    let compiledBlock;
    const statements = node.get('statements');
    const solo = node.get('solo', true); // solo defaults to true
    if (statements.count() === 0) {
      if (solo) {
        // A block by itself is like a function followed by invocation. An empty one returns null
        compiledBlock = 'null';
      }
      else {
        compiledBlock = '{}';
      }
    }
    else {
      let front;
      let tail;
      if (isDef(statements.last())) {
        front = statements;
        tail = dsl.Undefined;
      }
      else {
        front = statements.slice(0, statements.count() - 1);
        tail = statements.last();
      }
      const compiledFront = compileStatements(context, front);
      const compiledTail = compileNode(context, tail);

      if (isThrowUnary(tail)) {
        // No return is allowed here or needed
        compiledBlock = `${compiledFront} ${compiledTail};`;
      }
      else {
        compiledBlock = `${compiledFront} return ${compiledTail};`;
      }
      if (solo) {
        // A block by itself is like a function followed by invocation.
        compiledBlock = wrapWithAnonymousFunction(context, compiledBlock);
      }
      else {
        compiledBlock = `{ ${compiledBlock} }`;
      }
    }
    return compiledBlock;
  },

  InfixExpression: (context, node) =>
    `(${compileNode(context, node.get('left'))} ${
      _.get(infixOperatorMap, node.get('operator'), node.get('operator'))} ${
      compileNode(context, node.get('right'))})`,

  UnaryExpression: (context, node) => {
    const targetCode = compileNode(context, node.get('target'));
    switch (node.get('operator')) {
    case '!':
      return `!truthy(${targetCode})`;
    default:
      return `${node.get('operator')} ${targetCode}`;
    }
  },

  RestAssignment: (context, node) => `...${compileNode(context, node.get('item'))}`,

  Macro: (context, node) => {
    const value = node.get('value');
    const symbol = node.get('symbol');
    const code = `
      const fn = ${compileNode(context, value)};
      fn._wlt_macro = true;
      fn._wlt_macro_name = "${symbol}";
      return fn;`;

    return `${getVarDeclaration(context)} ${symbol} = ${wrapWithAnonymousFunction(context, code)}`;
  },

  Function: (context, node) => {
    const async = node.get('async');
    const args = node.get('args');
    const block = nonSoloBlock(node.get('block'));
    if (async) {
      context = _.clone(context);
      context.async = true;
    }
    let code = `(${compileAndJoin(context, args)}) => ${compileNode(context, block)}`;
    if (async) {
      code = `async ${code}`;
    }
    return code;
  },

  FunctionArgument: (context, node) => {
    let code = compileNode(context, node.get('arg'));
    const theDefault = node.get('theDefault');
    if (theDefault) {
      code = `${code} = ${compileNode(context, theDefault)}`;
    }
    return code;
  },

  ValueSequence: (context, node) => {
    const [precode, values] = handleJSSpecialKeywordOperatorValueSeq(context, node);
    const code = values.map((value) => {
      if (isFunction(value)) {
        return wrapParens(compileNode(context, value));
      }
      return compileNode(context, value);
    }).join('');
    return `${precode}${code}`;
  },
  Reference: (context, node) => node.get('symbol'),
  GetProperty: (context, node) => `.${node.get('attrib')}`,
  GetPropertyImmutable: (context, node) => `.get("${node.get('attrib')}")`,
  GetPropertyDynamic: (context, node) => wrapSquare(compileNode(context, node.get('attrib'))),
  FunctionCall: (context, node) => wrapParens(compileAndJoin(context, node.get('args'))),

  Null: () => 'null',

  Undefined: () => 'undefined',

  Quote: (context, node) => compileNode(context, quoter(node.get('value'))),

  Unquote: (context, node) => compileNode(context, node.get('value')),

  StringLiteral: (context, node) => JSON.stringify(node.get('value')),
  NumberLiteral: (context, node) => JSON.stringify(node.get('value')),
  BooleanLiteral: (context, node) => JSON.stringify(node.get('value')),
  ImmutableLiteral: (context, node) => `Immutable.fromJS(${JSON.stringify(node.get('value'))})`,

  StringInterpolation: (context, node) => `\`${
    node.get('parts').map((part) => {
      if (_.isString(part)) {
        return part;
      }
      return '${' + compileNode(context, part) + '}';
    }).join('')
  }\``,

  MapLiteral: (context, node) => {
    let code = wrapCurly(compileAndJoin(context, node.get('properties')));
    if (node.get('js')) {
      code = wrapParens(code);
    }
    else {
      code = `Immutable.Map${wrapParens(code)}`;
    }
    return code;
  },

  MapDestructuring: (context, node) =>
    wrapCurly(compileAndJoin(context, node.get('properties'))),

  Property: (context, node) => {
    let key = node.get('key');
    if (key._type) {
      key = compileNode(context, key);
    }
    return `${key}: ${compileNode(context, node.get('value'))}`;
  },

  ArrayLiteral: (context, node) => {
    let code = wrapSquare(compileAndJoin(context, node.get('values')));
    if (!node.get('js')) {
      code = `Immutable.List${wrapParens(code)}`;
    }
    return code;
  },

  SetLiteral: (context, node) =>
    `Immutable.Set([${compileAndJoin(context, node.get('values'))}])`,

  ListLiteral: (context, node) => wrapParens(compileAndJoin(context, node.get('values'))),

  ArrayDestructuring: (context, node) =>
    wrapSquare(compileAndJoin(context, node.get('values'))),

  Spread: (context, node) => `...${compileNode(context, node.get('item'))}`,

  Def: (context, node) => {
    const value = node.get('value') || dsl.Null;
    return `${getVarDeclaration(context, node.get('defType'))} ${
      compileNode(context, node.get('target'))
    } = ${compileNode(context, value)}`;
  },

  TryCatch: (context, node) => {
    const tryBlock = nonSoloBlock(node.get('tryBlock'));
    const finallyBlock = nonSoloBlock(node.get('finallyBlock'));
    const finallyCode = finallyBlock ? `finally ${compileNode(context, finallyBlock)}` : '';
    const tryCode = compileNode(context, tryBlock);

    if (node.get('catchBlock')) {
      const errorArg = compileNode(context, node.get('errorArg'));
      const catchBlock = nonSoloBlock(node.get('catchBlock'));
      const catchBlockCode = compileNode(context, catchBlock);
      return wrapWithAnonymousFunction(context,
        `try ${tryCode} catch(${errorArg}) ${catchBlockCode} ${finallyCode}`);
    }
    return wrapWithAnonymousFunction(context, `try ${tryCode} ${finallyCode}`);
  },

  IfList: (context, node) => wrapWithAnonymousFunction(context,
    `${node.get('items').map(_.partial(compileNode, context)).join('')}
      return null;`),

  If: (context, node) => {
    const cond = node.get('cond');
    const block = nonSoloBlock(node.get('block'));
    return `if (truthy(${compileNode(context, cond)})) ${compileNode(context, block)}`;
  },

  ElseIf: (context, node) => {
    const cond = node.get('cond');
    const block = nonSoloBlock(node.get('block'));
    return `else if (truthy(${compileNode(context, cond)})) ${compileNode(context, block)}`;
  },

  Else: (context, node) => `else ${compileNode(context, nonSoloBlock(node.get('block')))}`
};


compileNodeRaw = (context, node) => {
  const nodeType = astHelper.nodeType(node);

  if (!nodeType) {
    throw new Error(`Could not determine node type. May not be a AST node: ${node}`);
  }

  const compiler = typeToConverter[nodeType];

  if (compiler) {
    try {
      return compiler(context, node);
    }
    catch (error) {
      if (error.path) {
        error.path.unshift(astHelper.nodeType(node));
      }
      else {
        error.path = [astHelper.nodeType(node)];
      }
      throw error;
    }
  }
  const error = new Error(`Unknown node type ${astHelper.nodeType(node)}`);
  error.path = [astHelper.nodeType(node)];
  throw error;
};

const compile = (context, program) => {
  let compiledJs;
  // Sets whether we're in an async context or a regular context.
  context.async = false;
  try {
    compiledJs = compileNode(context, program);
  }
  catch (error) {
    const errorMsg = `
Error while compiling program to JavaScript
Error Message: ${error.message}
Path: ${error.path}
Program with error: ${JSON.stringify(program, null, 2)}
    `;
    throw new Error(errorMsg);
  }

  try {
    compiledJs = beautify(compiledJs);
  }
  catch (error) {
    console.log('Invalid JavaScript generated:', compiledJs);
    throw error;
  }
  return compiledJs;
};

module.exports = {
  compile
};
