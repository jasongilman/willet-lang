const _ = require('lodash');
// TODO use the creator functions from the grammar

const visitKeys = (context, visitor, walkFn, node, keys) => _.reduce(keys, (n, key) => {
  const value = n[key];
  if (_.isArray(value)) {
    n[key] = _.flatMap(value, (child) => walkFn(context, visitor, child));
  }
  else if (!_.isNil(value)) {
    n[key] = walkFn(context, visitor, value);
  }
  return n;
}, node);

const typeToChildren = {
  Program: ['statements'],
  Assignment: ['target', 'value'],
  InfixExpression: ['left', 'right'],
  MapDestructuring: ['targets'],
  ArrayDestructuring: ['targets'],
  Function: ['args', 'statements'],
  Spread: ['item'],
  ValueSequence: ['values'],
  GetPropertyDynamic: ['attrib'],
  FunctionCall: ['args'],
  Quote: ['block', 'expression'],
  Unquote: ['expression'],
  StringInterpolation: ['parts'],
  MapLiteral: ['properties'],
  Property: ['value'],
  ArrayLiteral: ['values'],
  Def: ['value'],
  TryCatch: ['tryBlock', 'errorBlock', 'catchBlock', 'finallyBlock'],
  IfList: ['items'],
  If: ['cond', 'block'],
  ElseIf: ['cond', 'block'],
  Else: ['block'],
  Macro: ['fn']
};

const doneWalking = (node) => ({ __special: 'DoneWalking', node });
const isDone = (node) => node.__special === 'DoneWalking';

const DEBUG = false;

const debug = (...args) => {
  if (DEBUG) {
    console.log(...args);
  }
};

const prewalk = (context, visitor, node) => {
  try {
    context.depth = _.get(context, 'depth', -1) + 1;
    debug(`Depth ${context.depth}: Prewalk visiting:`, node);
    node = visitor(context, node);

    if (isDone(node)) {
      node = node.node;
    }
    else {
      const childFields = typeToChildren[node.type];
      if (childFields) {
        node = visitKeys(context, visitor, prewalk, node, childFields);
      }
    }
    return node;
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
  finally {
    context.depth -= 1;
  }
};

const postwalk = (context, visitor, node) => {
  try {
    context.depth = _.get(context, 'depth', -1) + 1;
    debug(`Depth ${context.depth}: Postwalk visiting:`, node);
    const childFields = typeToChildren[node.type];
    if (childFields) {
      node = visitKeys(context, visitor, postwalk, node, childFields);
    }
    node = visitor(context, node);
    return node;
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
  finally {
    context.depth -= 1;
  }
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// AST DSL

const program = (...statements) => ({ type: 'Program', statements });

const func = (args = null, statements = []) => ({
  type: 'Function',
  async: false,
  args,
  statements
});


const symbolAssignment = (symbol) => ({ type: 'SymbolAssignment', symbol });
const spread = (item) => ({ type: 'Spread', item });
const restAssignment = (symbol) => ({ type: 'RestAssignment', symbol });

const assignment = (target, value) => {
  if (_.isString(target)) {
    target = symbolAssignment(target);
  }
  return {
    type: 'Assignment', target, value
  };
};

const mapDestructuring = (...targets) => ({ type: 'MapDestructuring', targets });
const arrayDestructuring = (...targets) => ({ type: 'ArrayDestructuring', targets });

const Null = { type: 'Null' };

const ifList = (...items) => ({ type: 'IfList', items });

const ifNode = (cond, block) => ({ type: 'If', cond, block });

const elseIfNode = (cond, block) => ({ type: 'ElseIf', cond, block });

const elseNode = (block) => ({ type: 'Else', block });

const def = (target, value) => (value ? { type: 'Def', target, value } : { type: 'Def', target });

const macro = (symbol, fn) => ({ type: 'Macro', symbol, fn });

const map = (...properties) => ({ type: 'MapLiteral', properties });

const array = (...values) => ({ type: 'ArrayLiteral', values });

const property = (key, value) => ({ type: 'Property', key, value });

const reference = (symbol) => ({ type: 'Reference', symbol });

const boolean = (value) => ({ type: 'BooleanLiteral', value });

const string = (value) => ({ type: 'StringLiteral', value });

const number = (value) => ({ type: 'NumberLiteral', value });

const stringInterpolation = (...parts) => ({ type: 'StringInterpolation', parts });

const tryCatch = (tryBlock, errorSymbol, catchBlock, finallyBlock = null) => ({
  type: 'TryCatch',
  tryBlock,
  errorSymbol,
  catchBlock,
  finallyBlock
});

const functionCall = (...args) => ({ type: 'FunctionCall', args });

const functionCallWithBody = (args, bodyStmts) => {
  const fn = functionCall(...args);
  fn.block = bodyStmts;
  return fn;
};

const valueSeq = (...values) => ({ type: 'ValueSequence', values });

const getProperty = (attrib) => ({ type: 'GetProperty', attrib });

const getPropertyDynamic = (attrib) => ({ type: 'GetPropertyDynamic', attrib });

const infix = (left, operator, right) => ({
  type: 'InfixExpression', operator, left, right
});
const plus = (left, right) => infix(left, '+', right);
const minus = (left, right) => infix(left, '-', right);
const multiply = (left, right) => infix(left, '*', right);
const divide = (left, right) => infix(left, '/', right);
const modulus = (left, right) => infix(left, '%', right);

const lessThan = (left, right) => infix(left, '<', right);
const greaterThan = (left, right) => infix(left, '>', right);
const lessThanOrEqual = (left, right) => infix(left, '<=', right);
const greaterThanOrEqual = (left, right) => infix(left, '>=', right);
const equal = (left, right) => infix(left, '==', right);
const notEqual = (left, right) => infix(left, '!=', right);

// Helper to convert any value into a literal representation
const literal = (value) => {
  let node;
  if (_.isNil(value)) {
    node = Null;
  }
  else if (_.isArray(value)) {
    node = array(...(_.map(value, literal)));
  }
  else if (_.isPlainObject(value)) {
    const properties = _(value)
      .toPairs()
      .map(([k, v]) => property(k, literal(v)))
      .value();
    node = map(...properties);
  }
  else if (_.isBoolean(value)) {
    node = boolean(value);
  }
  else if (_.isString(value)) {
    node = string(value);
  }
  else if (_.isNumber(value)) {
    node = number(value);
  }
  else {
    throw new Error(`Unable to convert value to literal [${value}]`);
  }
  return node;
};

const quote = (expression) => ({ type: 'Quote', expression });
const unquote = (expression) => ({ type: 'Unquote', expression });

const dsl = {
  program,
  func,
  symbolAssignment,
  assignment,
  mapDestructuring,
  arrayDestructuring,
  spread,
  restAssignment,
  Null,
  ifList,
  ifNode,
  elseIfNode,
  elseNode,
  def,
  macro,
  map,
  array,
  property,
  reference,
  string,
  boolean,
  number,
  stringInterpolation,
  tryCatch,
  functionCall,
  functionCallWithBody,
  valueSeq,
  getProperty,
  getPropertyDynamic,
  infix,
  plus,
  minus,
  multiply,
  divide,
  modulus,
  lessThan,
  greaterThan,
  lessThanOrEqual,
  greaterThanOrEqual,
  equal,
  notEqual,
  literal,
  quote,
  unquote
};

module.exports = {
  prewalk,
  doneWalking,
  postwalk,
  dsl
};