const _ = require('lodash');

const visitKeys = (context, visitor, walkFn, node, keys) => _.reduce(keys, (n, key) => {
  const value = n[key];
  if (_.isArray(value)) {
    n[key] = _.flatMap(value, (child) => walkFn(context, visitor, child));
  }
  else if (!_.isNil(value)) {
    n[key] = walkFn(context, visitor, value);
  }
  return n;
}, _.clone(node));

const typeToChildren = {
  Program: ['statements'],
  Block: ['statements'],
  Assignment: ['target', 'value'],
  InfixExpression: ['left', 'right'],
  Function: ['args', 'block'],
  Spread: ['item'],
  ValueSequence: ['values'],
  GetPropertyDynamic: ['attrib'],
  FunctionCall: ['args', 'block'],
  Quote: ['block', 'expression'],
  Unquote: ['expression'],
  StringInterpolation: ['parts'],
  MapLiteral: ['properties'],
  Property: ['value'],
  ArrayLiteral: ['values'],
  Def: ['target', 'value'],
  TryCatch: ['tryBlock', 'errorBlock', 'catchBlock', 'finallyBlock'],
  IfList: ['items'],
  If: ['cond', 'block'],
  ElseIf: ['cond', 'block'],
  Else: ['block'],
  Macro: ['value']
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
    const initialNode = node;
    context.depth = _.get(context, 'depth', -1) + 1;
    debug(`Depth ${context.depth}: Prewalk visiting:`, node);
    node = visitor(context, node);

    if (DEBUG) {
      if (!_.isEqual(initialNode, node)) {
        console.log('-----------------------------------');
        debug('Modified the node');
        console.log('before:', initialNode);
        console.log(' after:', node);
        console.log('-----------------------------------');
      }
    }

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
    const initialNode = node;
    context.depth = _.get(context, 'depth', -1) + 1;
    debug(`Depth ${context.depth}: Postwalk visiting:`, node);
    const childFields = typeToChildren[node.type];
    if (childFields) {
      node = visitKeys(context, visitor, postwalk, node, childFields);
    }
    node = visitor(context, node);
    if (DEBUG) {
      if (!_.isEqual(initialNode, node)) {
        console.log('-----------------------------------');
        debug('Modified the node');
        console.log('initialNode:', initialNode);
        console.log('node:', node);
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

const prepostwalk = (context, [preVisitor, postVisitor], node) => {
  try {
    context.depth = _.get(context, 'depth', -1) + 1;
    debug(`Depth ${context.depth}: PrePostwalk visiting:`, node);
    let beforeVisitNode = node;
    node = preVisitor(context, node);

    if (DEBUG) {
      if (!_.isEqual(beforeVisitNode, node)) {
        console.log('-----------------------------------');
        debug('Modified the node with preVisitor');
        console.log('before:', beforeVisitNode);
        console.log(' after:', node);
        console.log('-----------------------------------');
      }
    }

    if (isDone(node)) {
      node = node.node;
    }
    else {
      const childFields = typeToChildren[node.type];
      if (childFields) {
        node = visitKeys(context, [preVisitor, postVisitor], prepostwalk, node, childFields);
      }
      beforeVisitNode = node;
      node = postVisitor(context, node);

      if (DEBUG) {
        if (!_.isEqual(beforeVisitNode, node)) {
          console.log('-----------------------------------');
          debug('Modified the node with postVisitor');
          console.log('before:', beforeVisitNode);
          console.log(' after:', node);
          console.log('-----------------------------------');
        }
      }
    }
    return node;
  }
  catch (error) {
    if (error.path) {
      error.path.unshift(_.get(node, 'type', 'UNKNOWN'));
    }
    else {
      error.path = [_.get(node, 'type', 'UNKNOWN')];
    }
    throw error;
  }
  finally {
    context.depth -= 1;
  }
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// AST DSL

const staticJs = (code) => ({ type: 'StaticJSCode', code });

const program = (...statements) => ({ type: 'Program', statements });

const block = (...statements) => ({ type: 'Block', statements });

const soloBlock = (...statements) => ({ type: 'Block', solo: true, statements });

const func = (args = [], blok = block(), async = false) => ({
  type: 'Function',
  async,
  args,
  block: blok
});

const funcArg = (arg, theDefault = null) => ({
  type: 'FunctionArgument', arg, theDefault
});

const spread = (item) => ({ type: 'Spread', item });
const restAssignment = (item) => ({ type: 'RestAssignment', item });

const reference = (symbol) => ({ type: 'Reference', symbol });

const assignment = (target, value) => {
  if (_.isString(target)) {
    target = reference(target);
  }
  return {
    type: 'Assignment', target, value
  };
};

const Null = { type: 'Null' };

const ifList = (...items) => ({ type: 'IfList', items });

const ifNode = (cond, blok) => ({ type: 'If', cond, block: blok });

const elseIfNode = (cond, blok) => ({ type: 'ElseIf', cond, block: blok });

const elseNode = (blok) => ({ type: 'Else', block: blok });

const def = (target, value) => (value ? { type: 'Def', target, value } : { type: 'Def', target });

const macro = (symbol, value) => ({ type: 'Macro', symbol, value });

const map = (...properties) => ({ type: 'MapLiteral', properties });

const array = (...values) => ({ type: 'ArrayLiteral', values });

const property = (key, value) => ({ type: 'Property', key, value });

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

const functionCallWithBody = (args = [], blok = block()) => {
  const fn = functionCall(...args);
  fn.block = blok;
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

const and = (left, right) => infix(left, '&&', right);
const or = (left, right) => infix(left, '||', right);

const not = (expr) => ({ type: 'UnaryExpression', operator: '!', target: expr });

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

const quoteWithExpression = (expression) => ({ type: 'Quote', expression });
const quoteWithBlock = (blok) => ({ type: 'Quote', block: blok });

const unquote = (expression) => ({ type: 'Unquote', expression });

const dsl = {
  staticJs,
  program,
  block,
  soloBlock,
  func,
  funcArg,
  assignment,
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
  and,
  or,
  not,
  literal,
  quoteWithExpression,
  quoteWithBlock,
  unquote
};

module.exports = {
  prewalk,
  doneWalking,
  postwalk,
  prepostwalk,
  dsl
};
