/* eslint-disable prefer-template */
const _ = require('lodash');
const beautify = require('js-beautify').js;
const astHelper = require('./ast-helper');
const { dsl } = astHelper;

let compileNode;

const compileStatements = (statements) => _(statements)
  .map(compileNode)
  .map((s) => {
    // Don't end StaticJSCode with a semicolon. This produces code that has problems in beautify
    if (s.type !== 'StaticJSCode') {
      s = `${s};`;
    }
    return s;
  })
  .values()
  .join('\n');

const compileAndJoin = (nodes, join = ', ') => _.map(nodes, compileNode).join(join);

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

const typeToConverter = {
  StaticJSCode: ({ code }) => code,

  Program: ({ statements }) => compileStatements(statements),
  Block: ({ solo, statements }) => {
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
      compiledBlock = `{${
        compileStatements(front)}
        return ${compileNode(tail)}; }`;
      if (solo) {
        // A block by itself is like a function followed by invocation.
        compiledBlock = `(() => ${compiledBlock})()`;
      }
    }
    return compiledBlock;
  },

  // The parentheses allow map destructuring to always work
  Assignment: ({ target, value }) => `(${compileNode(target)} = ${compileNode(value)})`,

  InfixExpression: ({ left, operator, right }) =>
    `(${compileNode(left)} ${operator} ${compileNode(right)})`,

  UnaryExpression: ({ operator, target }) => `(${operator}${compileNode(target)})`,

  RestAssignment: ({ symbol }) => `...${symbol}`,

  Macro: ({ symbol, value }) => {
    if (value.type === 'MapLiteral') {
      return `let ${symbol} = (() => {
        const value = ${compileNode(value)};
        const fn = value.handler;
        fn._wlt_macro = true;
        fn._wlt_macro_terms = value.terms;
        return fn;
      })()`;
    }
    return `let ${symbol} = (() => {
      const fn = ${compileNode(value)};
      fn._wlt_macro = true;
      return fn;
    })()`;
  },

  Function: ({
    async, args, block
  }) => {
    let code = `(${compileAndJoin(args)}) => ${compileNode(block)}`;
    if (async) {
      code = `async ${code}`;
    }
    return code;
  },

  ValueSequence: ({ values }) =>
    _.map(values, (value) => {
      if (value.type === 'Function') {
        return wrapParens(compileNode(value));
      }
      return compileNode(value);
    }).join(''),
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

  StringInterpolation: ({ parts }) => `\`${
    _.map(parts, (part) => {
      if (_.isString(part)) {
        return part;
      }
      return '${' + compileNode(part) + '}';
    }).join('')
  }\``,

  MapLiteral: ({ properties }) => wrapCurly(compileAndJoin(properties)),
  Property: ({ key, value }) => `${key}: ${compileNode(value)}`,
  ArrayLiteral: ({ values }) => wrapSquare(compileAndJoin(values)),
  Spread: ({ item }) => `...${compileNode(item)}`,

  Def: ({ target, value }) => {
    value = value || dsl.Null;
    return `let ${compileNode(target)} = ${compileNode(value)}`;
  },

  TryCatch: ({
    tryBlock,
    errorSymbol,
    catchBlock,
    finallyBlock
  }) => `(() => {
      try ${compileNode(tryBlock)}
      catch(${errorSymbol}) ${compileNode(catchBlock)}
      ${
  finallyBlock ?
    `finally ${compileNode(finallyBlock)}`
    : ''}
    })()`,

  IfList: ({ items }) => `(() => {${
    _.map(items, compileNode).join('')
  }
      return null;
    })()`,

  If: ({ cond, block }) => `if (${compileNode(cond)}) ${
    compileNode(block)}`,

  ElseIf: ({ cond, block }) => `else if (${compileNode(cond)}) ${
    compileNode(block)}`,

  Else: ({ block }) => `else ${compileNode(block)}`

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
