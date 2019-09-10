/* eslint-disable prefer-template */
const _ = require('lodash');
const beautify = require('js-beautify').js;
const astHelper = require('./ast-helper');
const { dsl } = astHelper;

let compileNode;

const compileStatements = (statements) => _(statements)
  .map(compileNode)
  .map((s) => `${s};`)
  .values()
  .join('\n');

const compileAndJoin = (nodes, join = ', ') => _.map(nodes, compileNode).join(join);


const wrapParens = (value) => `(${value})`;
const wrapCurly = (value) => `{${value}}`;
const wrapSquare = (value) => `[${value}]`;

const compileBlockStatements = (statements) => {
  if (_.isEmpty(statements)) {
    return '{}';
  }
  const front = _.slice(statements, 0, statements.length - 1);
  const tail = _.last(statements);
  return `{${
    compileStatements(front)}
    return ${compileNode(tail)}; }`;
};


const quoter = (value) => {
  let node;
  if (_.isArray(value)) {
    node = dsl.array(...(_.map(value, quoter)));
  }
  else if (_.isPlainObject(value)) {
    if (value.type === 'Unquote') {
      node = value;
    }
    else {
      const properties = _(value)
        .toPairs()
        .map(([k, v]) => dsl.property(k, quoter(v)))
        .value();
      node = dsl.map(...properties);
    }
  }
  else {
    node = dsl.literal(value);
  }
  return node;
};

const typeToConverter = {
  Program: ({ statements }) => compileStatements(statements),

  // The parentheses allow map destructuring to always work
  Assignment: ({ target, value }) => `(${compileNode(target)} = ${compileNode(value)})`,

  InfixExpression: ({ left, operator, right }) =>
    `(${compileNode(left)} ${operator} ${compileNode(right)})`,

  SymbolAssignment: ({ symbol }) => symbol,
  RestAssignment: ({ symbol }) => `...${symbol}`,
  MapDestructuring: ({ targets }) => wrapCurly(compileAndJoin(targets)),
  ArrayDestructuring: ({ targets }) => wrapSquare(compileAndJoin(targets)),

  // TODO async
  // Adds field to macros of functions that are evaluated.
  Function: ({
    _async, macro, args, statements
  }) => {
    if (macro) {
      return `(() => {
        const fn = (${compileAndJoin(args)}) => ${compileBlockStatements(statements)};
        fn._wlt_macro = true;
        return fn;
      })()`;
    }
    return `(${compileAndJoin(args)}) => ${compileBlockStatements(statements)}`;
  },

  ValueSequence: ({ values }) => compileAndJoin(values, ''),
  Reference: ({ symbol }) => symbol,
  GetProperty: ({ attrib }) => `.${attrib}`,
  GetPropertyDynamic: ({ attrib }) => wrapSquare(compileNode(attrib)),
  FunctionCall: ({ args }) => wrapParens(compileAndJoin(args)),

  Null: () => 'null',

  Quote: ({ expression, block }) => {
    if (expression) {
      return compileNode(quoter(expression));
    }
    return '[].concat(...' +
      wrapSquare(_.map(block, (stmt) => compileNode(quoter(stmt))))
      + ')';
  },
  Unquote: ({ expression }) => compileNode(expression),
  StringLiteral: ({ value }) => JSON.stringify(value),
  NumberLiteral: ({ value }) => JSON.stringify(value),
  BooleanLiteral: ({ value }) => JSON.stringify(value),

  // TODO make the string parts into string literals (maybe) Might help node navigation
  // TODO test macro calls or quote/unquote within a string interpolator
  StringInterpolation: ({ parts }) => `\`${
    _.map(parts, (part) => {
      if (_.isString(part)) {
        return part;
      }
      return '${' + compileNode(part) + '}';
    }).join('')
  }\``,

  MapLiteral: ({ properties }) => wrapParens(wrapCurly(compileAndJoin(properties))),
  Property: ({ key, value }) => `${key}: ${compileNode(value)}`,
  ArrayLiteral: ({ values }) => wrapSquare(compileAndJoin(values)),
  Spread: ({ item }) => `...${compileNode(item)}`,

  Def: ({ target, value }) =>
    (value ? `let ${compileNode(target)} = ${compileNode(value)}` : `let ${compileNode(target)}`),

  Macro: ({ symbol, fn }) => `let ${symbol} = ${compileNode(fn)}`,

  TryCatch: ({
    tryBlock,
    errorSymbol,
    catchBlock,
    finallyBlock
  }) => `(() => {
      try ${compileBlockStatements(tryBlock)}
      catch(${errorSymbol}) ${compileBlockStatements(catchBlock)}
      ${
  finallyBlock ?
    `finally ${compileBlockStatements(finallyBlock)}`
    : ''}
    })()`,

  IfList: ({ items }) => `(() => {${
    _.map(items, compileNode).join('')
  }
      return null;
    })()`,

  If: ({ cond, block }) => `if (${compileNode(cond)}) ${
    compileBlockStatements(block)}`,

  ElseIf: ({ cond, block }) => `else if (${compileNode(cond)}) ${
    compileBlockStatements(block)}`,

  Else: ({ block }) => `else ${compileBlockStatements(block)}`

};


compileNode = (node) => {
  const compiler = typeToConverter[node.type];

  if (compiler) {
    try {
      return compiler(node);
    }
    catch (error) {
      if (error.path) {
        error.path.unshift(node.type);
      }
      else {
        error.path = [node.type];
      }
      throw error;
    }
  }
  const error = new Error(`Unknown node type ${node.type}`);
  error.path = [node.type];
  throw error;
};

const compile = (program) => {
  let compiledJs;
  try {
    compiledJs = compileNode(program);
  }
  catch (error) {
    console.log('program with error:', JSON.stringify(program, null, 2));
    console.log(error);
    console.log('Path: ', error.path);
    throw error;
  }
  try {
    return beautify(compiledJs);
  }
  catch (error) {
    console.log('Invalid JavaScript generated:', compiledJs);
    throw error;
  }
};

module.exports = {
  compile
};
