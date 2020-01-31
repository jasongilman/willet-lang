/* eslint-disable prefer-template */
const _ = require('lodash');
const beautify = require('js-beautify').js;
const astHelper = require('./ast-helper');
const { dsl } = astHelper;

const isThrowValueSeq = (node) =>
  node.type === 'ValueSequence' &&
  _.get(node.values, '0.type') === 'Reference' &&
  _.get(node.values, '0.symbol') === 'throw';

let compileNode;

const compileStatements = (context, statements) => _(statements)
  .map(_.partial(compileNode, context))
  .map((s) => {
    // Don't end StaticJSCode with a semicolon. This produces code that has problems in beautify
    if (s.type !== 'StaticJSCode') {
      s = `${s};`;
    }
    return s;
  })
  .values()
  .join('\n');

const compileAndJoin = (context, nodes, join = ', ') =>
  _.map(nodes, _.partial(compileNode, context)).join(join);

const wrapParens = (value) => `(${value})`;
const wrapCurly = (value) => `{${value}}`;
const wrapSquare = (value) => `[${value}]`;

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

const handleJSSpecialKeywordOperatorValueSeq = (context, { values }) => {
  let code = '';
  let remainingValues = values;
  if (_.get(values, '0.type') === 'Reference'
      && _.get(values, '0.symbol')
      && _.get(values, '1.type') === 'FunctionCall') {
    const symbol = _.get(values, '0.symbol');
    let afterCode;
    switch (symbol) {
    case 'new':
      afterCode = compileAndJoin(context, values[1].args);
      code = `new ${afterCode}`;
      remainingValues = _.drop(values, 2);
      break;
    case 'throw':
      afterCode = compileAndJoin(context, values[1].args);
      code = `throw ${afterCode}`;
      remainingValues = _.drop(values, 2);
      break;
    case 'instanceof':
      const instance = compileNode(context, values[1].args[0]);
      const type = compileNode(context, values[1].args[1]);
      code = `(${instance} instanceof ${type})`;
      remainingValues = _.drop(values, 2);
      break;
    default:
        // code will be null and default value sequence will be processed
    }
  }
  return [code, remainingValues];
};

const typeToConverter = {
  StaticJSCode: (context, { code }) => code,

  Program: (context, { statements }) => compileStatements(context, statements),
  Block: (context, { solo, statements }) => {
    let compiledBlock;
    if (_.isEmpty(statements)) {
      if (solo) {
        // A block by itself is like a function followed by invocation. An empty one returns null
        compiledBlock = 'null';
      }
      else {
        compiledBlock = '{}';
      }
    }
    else {
      const front = _.slice(statements, 0, statements.length - 1);
      const tail = _.last(statements);
      const compiledFront = compileStatements(context, front);
      const compiledTail = compileNode(context, tail);
      if (isThrowValueSeq(tail)) {
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

  // The parentheses allow map destructuring to always work
  Assignment: (context, { target, value }) =>
    `(${compileNode(context, target)} = ${compileNode(context, value)})`,

  InfixExpression: (context, { left, operator, right }) =>
    `(${compileNode(context, left)} ${
      _.get(infixOperatorMap, operator, operator)} ${
      compileNode(context, right)})`,

  NegatedExpression: (context, { target }) =>
    `!truthy(${compileNode(context, target)})`,

  RestAssignment: (context, { item }) => `...${compileNode(context, item)}`,

  Macro: (context, { symbol, value }) => {
    let code;
    if (value.type === 'MapLiteral') {
      code = `
        const value = ${compileNode(context, value)};
        const fn = value.handler;
        fn._wlt_macro = true;
        fn._wlt_macro_terms = value.terms;
        return fn;`;
    }
    else {
      code = `
        const fn = ${compileNode(context, value)};
        fn._wlt_macro = true;
        return fn;`;
    }
    return `let ${symbol} = ${wrapWithAnonymousFunction(context, code)}`;
  },

  Function: (context, {
    async, args, block
  }) => {
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

  FunctionArgument: (context, { arg, theDefault }) => {
    let code = compileNode(context, arg);
    if (theDefault) {
      code = `${code} = ${compileNode(context, theDefault)}`;
    }
    return code;
  },

  ValueSequence: (context, node) => {
    const [precode, values] = handleJSSpecialKeywordOperatorValueSeq(context, node);
    const code = _.map(values, (value) => {
      if (value.type === 'Function') {
        return wrapParens(compileNode(context, value));
      }
      return compileNode(context, value);
    }).join('');
    const result = `${precode}${code}`;
    return result;
  },
  Reference: (context, { symbol }) => symbol,
  GetProperty: (context, { attrib }) => `.${attrib}`,
  GetPropertyDynamic: (context, { attrib }) => wrapSquare(compileNode(context, attrib)),
  FunctionCall: (context, { args }) => wrapParens(compileAndJoin(context, args)),

  Null: () => 'null',

  Quote: (context, { expression, block }) => {
    if (expression) {
      return compileNode(context, quoter(expression));
    }
    return compileNode(context, quoter(block));
    // return '[].concat(...' +
    //   wrapSquare(_.map(block, (stmt) => compileNode(context, quoter(stmt))))
    //   + ')';
  },
  Unquote: (context, { expression }) => compileNode(context, expression),
  StringLiteral: (context, { value }) => JSON.stringify(value),
  NumberLiteral: (context, { value }) => JSON.stringify(value),
  BooleanLiteral: (context, { value }) => JSON.stringify(value),

  StringInterpolation: (context, { parts }) => `\`${
    _.map(parts, (part) => {
      if (_.isString(part)) {
        return part;
      }
      return '${' + compileNode(context, part) + '}';
    }).join('')
  }\``,

  MapLiteral: (context, { properties }) => wrapCurly(compileAndJoin(context, properties)),
  // MapLiteral: (context, { properties }) => `Immutable.Map${
  //   wrapParens(wrapCurly(compileAndJoin(context, properties)))}`,

  MapDestructuring: (context, { properties }) => wrapCurly(compileAndJoin(context, properties)),

  Property: (context, { key, value }) => `${key}: ${compileNode(context, value)}`,

  ArrayLiteral: (context, { values }) => wrapSquare(compileAndJoin(context, values)),

  // ArrayLiteral: (context, { values }) => `Immutable.List${
  //   wrapParens(wrapSquare(compileAndJoin(context, values)))}`,

  ArrayDestructuring: (context, { values }) => wrapSquare(compileAndJoin(context, values)),

  Spread: (context, { item }) => `...${compileNode(context, item)}`,

  Def: (context, { target, value }) => {
    value = value || dsl.Null;
    return `let ${compileNode(context, target)} = ${compileNode(context, value)}`;
  },

  TryCatch: (context, {
    tryBlock,
    errorSymbol,
    catchBlock,
    finallyBlock
  }) => {
    const finallyCode = finallyBlock ? `finally ${compileNode(context, finallyBlock)}` : '';
    const tryCode = compileNode(context, tryBlock);
    const catchBlockCode = compileNode(context, catchBlock);

    return wrapWithAnonymousFunction(context,
      `try ${tryCode} catch(${errorSymbol}) ${catchBlockCode} ${finallyCode}`);
  },

  IfList: (context, { items }) => wrapWithAnonymousFunction(context,
    `${_.map(items, _.partial(compileNode, context)).join('')}
      return null;`),

  If: (context, { cond, block }) => `if (truthy(${compileNode(context, cond)})) ${
    compileNode(context, block)}`,

  ElseIf: (context, { cond, block }) => `else if (truthy(${compileNode(context, cond)})) ${
    compileNode(context, block)}`,

  Else: (context, { block }) => `else ${compileNode(context, block)}`

};


compileNode = (context, node) => {
  const compiler = typeToConverter[node.type];

  if (compiler) {
    try {
      return compiler(context, node);
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
  const error = new Error(`Unknown node type ${_.get(node, 'type')}`);
  error.path = [node.type];
  throw error;
};

const compile = (program) => {
  let compiledJs;
  const context = {
    // Sets whether we're in an async context or a regular context.
    async: false
  };
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
