/* eslint-disable prefer-template */
const _ = require('lodash');
const Immutable = require('immutable');
const { List, Record } = Immutable;
const astHelper = require('./ast-helper');
const {
  dsl, isFunction, isUnquote, isStringLiteral
} = astHelper;

let compileNodeRaw;

const getIndentStr = (context) => _.repeat('  ', context.indent);

const withIndent = (context) => {
  const newContext = _.clone(context);
  newContext.indent += 1;
  return newContext;
};

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

const compileStatements = (context, statements) =>
  statements
    .map(_.partial(compileNode, context))
    .join(`\n${getIndentStr(context)}`);

const compileAndJoin = (context, nodes, join = ' ') =>
  nodes.map(_.partial(compileNode, context)).join(join);

const wrapNewlines = (context, value) => {
  if (_.isNil(value) || value === '') {
    return value;
  }
  return `\n${getIndentStr(context)}  ${value}\n${getIndentStr(context)}`;
};

const wrapPoundParens = (context, value) => `#(${wrapNewlines(context, value)})`;
const wrapParens = (context, value) => `(${wrapNewlines(context, value)})`;
const wrapCurly = (context, value) => `{${wrapNewlines(context, value)}}`;
const wrapPoundCurly = (context, value) => `#{${wrapNewlines(context, value)}}`;
const wrapSquare = (context, value) => `[${wrapNewlines(context, value)}]`;
const wrapPoundSquare = (context, value) => `#[${wrapNewlines(context, value)}]`;

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

const typeToConverter = {
  Program: (context, node) => compileStatements(context, node.get('statements')),
  AnnotatedNode: (context, node) => {
    const annotation = node.get('annotation');
    const childNode = node.get('node');
    return `${compileNode(context, annotation)}\n${getIndentStr(context)
    }${compileNode(context, childNode)}`;
  },
  Block: (context, node) => wrapCurly(context, compileStatements(
    withIndent(context),
    node.get('statements')
  )),

  InfixExpression: (context, node) =>
    `${compileNode(context, node.get('left'))} ${node.get('operator')} ${
      compileNode(context, node.get('right'))}`,

  UnaryExpression: (context, node) => {
    const targetCode = compileNode(context, node.get('target'));
    return `${node.get('operator')} ${targetCode}`;
  },

  RestAssignment: (context, node) => `...${compileNode(context, node.get('item'))}`,

  Macro: (context, node) => {
    const value = node.get('value');
    const symbol = node.get('symbol');
    return `defmacro ${symbol} = ${compileNode(context, value)}`;
  },

  Function: (context, node) => {
    const async = node.get('async');
    const args = node.get('args');
    const block = node.get('block');
    if (async) {
      context = _.clone(context);
      context.async = true;
    }
    let code = `${wrapPoundParens(context, compileAndJoin(withIndent(context), args))} => ${
      compileNode(context, block)}`;
    if (async) {
      code = `@async ${code}`;
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

  ValueSequence: (context, node) =>
    node.get('values').map((value) => {
      if (isFunction(value)) {
        return wrapParens(context, compileNode(withIndent(context), value));
      }
      return compileNode(context, value);
    }).join(''),
  Reference: (context, node) => node.get('symbol'),
  GetProperty: (context, node) => `.${node.get('attrib')}`,
  GetPropertyImmutable: (context, node) => `.:${node.get('attrib')}`,
  GetPropertyDynamic: (context, node) => `.[${compileNode(context, node.get('attrib'))}]`,

  FunctionCall: (context, node) => {
    const args = node.get('args');
    const block = node.get('block');
    let code = wrapParens(context, compileAndJoin(withIndent(context), args));
    if (block) {
      code = `${code} ${compileNode(context, block)}`;
    }
    return code;
  },

  Null: () => 'null',

  Undefined: () => 'undefined',

  Quote: (context, node) => compileNode(context, quoter(node.get('value'))),

  Unquote: (context, node) => compileNode(context, node.get('value')),

  StringLiteral: (context, node) => JSON.stringify(node.get('value')),
  NumberLiteral: (context, node) => JSON.stringify(node.get('value')),
  BooleanLiteral: (context, node) => JSON.stringify(node.get('value')),
  ImmutableLiteral: (context, node) => wrapParens(context, JSON.stringify(node.get('value'))),

  StringInterpolation: (context, node) => `\`${
    node.get('parts').map((part) => {
      if (isStringLiteral(part)) {
        const escapedInQuotes = JSON.stringify(part.get('value'));
        return escapedInQuotes.slice(1, escapedInQuotes.length - 1);
      }
      return '${' + compileNode(context, part) + '}';
    }).join('')
  }\``,

  MapLiteral: (context, node) => {
    let code = wrapPoundCurly(context, compileAndJoin(withIndent(context), node.get('properties'),
      `\n${getIndentStr(context)}  `));
    if (node.get('js')) {
      code = `jsObject(${code})`;
    }
    return code;
  },

  AnnotationMap: (context, node) => {
    const code = wrapCurly(context, compileAndJoin(withIndent(context), node.get('properties'),
      `\n${getIndentStr(context)}  `));
    return `@${code}`;
  },

  MapDestructuring: (context, node) =>
    wrapPoundCurly(context, compileAndJoin(withIndent(context), node.get('properties'),
      `\n${getIndentStr(context)}  `)),

  Property: (context, node) => {
    let key = node.get('key');
    if (key._type) {
      key = compileNode(context, key);
    }
    return `${key}: ${compileNode(context, node.get('value'))}`;
  },

  ArrayLiteral: (context, node) => {
    let code = wrapSquare(context, compileAndJoin(withIndent(context), node.get('values')));
    if (node.get('js')) {
      code = `jsArray(${code})`;
    }
    return code;
  },

  SetLiteral: (context, node) =>
    wrapPoundSquare(context, compileAndJoin(withIndent(context), node.get('values'))),

  ListLiteral: (context, node) => wrapPoundParens(context,
    compileAndJoin(withIndent(context), node.get('values'))),

  ArrayDestructuring: (context, node) =>
    wrapSquare(context, compileAndJoin(withIndent(context), node.get('values'))),

  Spread: (context, node) => `...${compileNode(context, node.get('item'))}`,

  Def: (context, node) => {
    const annotation = node.get('annotation');
    const value = node.get('value') || dsl.Null;
    let code = `${
      node.get('defType')} ${
      compileNode(context, node.get('target'))} = ${
      compileNode(context, value)}`;
    if (annotation) {
      code = `${compileNode(context, annotation)}\n${getIndentStr(context)}${code}`;
    }
    return code;
  },

  TryCatch: (context, node) => {
    const tryBlock = node.get('tryBlock');
    const finallyBlock = node.get('finallyBlock');
    const finallyCode = finallyBlock ? `finally ${compileNode(context, finallyBlock)}` : '';
    const tryCode = compileNode(context, tryBlock);

    let code = `try ${tryCode}`;
    if (node.get('catchBlock')) {
      const errorArg = compileNode(context, node.get('errorArg'));
      const catchBlock = node.get('catchBlock');
      const catchBlockCode = compileNode(context, catchBlock);
      code = `${code}\n${getIndentStr(context)}catch(${errorArg}) ${catchBlockCode}`;
    }
    if (finallyCode) {
      code = `${code}\n${getIndentStr(context)}${finallyCode}`;
    }
    return code;
  },

  IfList: (context, node) => node.get('items').map(_.partial(compileNode, context)).join(''),

  If: (context, node) => {
    const cond = node.get('cond');
    const block = node.get('block');
    return `if (${compileNode(context, cond)}) ${compileNode(context, block)}`;
  },

  ElseIf: (context, node) => {
    const cond = node.get('cond');
    const block = node.get('block');
    return `elseif (${compileNode(context, cond)}) ${compileNode(context, block)}`;
  },

  Else: (context, node) => `else ${compileNode(context, node.get('block'))}`
};


compileNodeRaw = (context, node) => {
  const compiler = typeToConverter[astHelper.nodeType(node)];

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

const compile = (program) => {
  let compiledJs;
  const context = {
    // Sets whether we're in an async context or a regular context.
    async: false,
    indent: 0
  };
  try {
    compiledJs = compileNode(context, program);
  }
  catch (error) {
    // FUTURE temporary logging
    console.log(error);
    const errorMsg = `
Error while compiling program to Willet
Error Message: ${error.message}
Path: ${error.path}
Program with error: ${JSON.stringify(program, null, 2)}
    `;
    throw new Error(errorMsg);
  }
  return compiledJs;
};

module.exports = {
  compile
};
