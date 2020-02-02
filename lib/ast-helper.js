const _ = require('lodash');
const Immutable = require('immutable');
const { fromJS, List } = Immutable;

const visitKeys = (context, visitor, walkFn, node, keys) => keys.reduce((n, key) => {
  const value = n.get(key);
  if (List.isList(value)) {
    n = n.set(key, value.flatMap((child) => {
      const result = walkFn(context, visitor, child);
      if (!List.isList(result)) {
        return List([result]);
      }
      return result;
    }));
  }
  else if (!_.isNil(value)) {
    n = n.set(key, walkFn(context, visitor, value));
  }
  return n;
}, node);

const typeToChildren = fromJS({
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
});

const doneWalking = (node) => fromJS({ __special: 'DoneWalking', node });
const isDone = (node) => node.get && node.get('__special') === 'DoneWalking';

const nodeType = (node, def = null) => ((node && node.get) ? node.get('type', def) : def);

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
      if (!initialNode.equals(node)) {
        console.log('-----------------------------------');
        debug('Modified the node');
        console.log('before:', initialNode);
        console.log(' after:', node);
        console.log('-----------------------------------');
      }
    }

    if (isDone(node)) {
      node = node.get('node');
    }
    else {
      const childFields = typeToChildren.get(nodeType(node));
      if (childFields) {
        node = visitKeys(context, visitor, prewalk, node, childFields);
      }
    }
    return node;
  }
  catch (error) {
    // FUTURE remove this temporary logging
    console.log(error);
    if (error.path) {
      error.path.unshift(nodeType(node, 'UNKNOWN'));
    }
    else {
      error.path = [nodeType(node, 'UNKNOWN')];
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
    const childFields = typeToChildren.get(nodeType(node));
    if (childFields) {
      node = visitKeys(context, visitor, postwalk, node, childFields);
    }
    node = visitor(context, node);
    if (DEBUG) {
      if (!initialNode.equals(node)) {
        console.log('-----------------------------------');
        debug('Modified the node');
        console.log('initialNode:', initialNode);
        console.log('node:', node);
      }
    }
    return node;
  }
  catch (error) {
    // FUTURE remove this temporary logging
    console.log(error);
    if (error.path) {
      error.path.unshift(nodeType(node, 'UNKNOWN'));
    }
    else {
      error.path = [nodeType(node, 'UNKNOWN')];
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
      if (!beforeVisitNode.equals(node)) {
        console.log('-----------------------------------');
        debug('Modified the node with preVisitor');
        console.log('before:', beforeVisitNode);
        console.log(' after:', node);
        console.log('-----------------------------------');
      }
    }

    if (isDone(node)) {
      node = node.get('node');
    }
    else {
      const childFields = typeToChildren.get(nodeType(node));
      if (childFields) {
        node = visitKeys(context, [preVisitor, postVisitor], prepostwalk, node, childFields);
      }
      beforeVisitNode = node;
      node = postVisitor(context, node);

      if (DEBUG) {
        if (!beforeVisitNode.equals(node)) {
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
    // FUTURE remove this temporary logging
    console.log(error);
    if (error.path) {
      error.path.unshift(nodeType(node, 'UNKNOWN'));
    }
    else {
      error.path = [nodeType(node, 'UNKNOWN')];
    }
    throw error;
  }
  finally {
    context.depth -= 1;
  }
};

////////////////////////////////////////////////////////////////////////////////////////////////////
// AST DSL

const staticJs = (code) => fromJS({ type: 'StaticJSCode', code });

const program = (...statements) => fromJS({ type: 'Program', statements });

const block = (...statements) => fromJS({ type: 'Block', statements });

const soloBlock = (...statements) => fromJS({ type: 'Block', solo: true, statements });

const func = (args = [], blok = block(), async = false) => fromJS({
  type: 'Function',
  async,
  args,
  block: blok
});

const funcArg = (arg, theDefault = null) => fromJS({
  type: 'FunctionArgument', arg, theDefault
});

const spread = (item) => fromJS({ type: 'Spread', item });
const restAssignment = (item) => fromJS({ type: 'RestAssignment', item });

const reference = (symbol) => fromJS({ type: 'Reference', symbol });

const assignment = (target, value) => {
  if (_.isString(target)) {
    target = reference(target);
  }
  return fromJS({
    type: 'Assignment', target, value
  });
};

const Null = fromJS({ type: 'Null' });

const ifList = (...items) => fromJS({ type: 'IfList', items });

const ifNode = (cond, blok) => fromJS({ type: 'If', cond, block: blok });

const elseIfNode = (cond, blok) => fromJS({ type: 'ElseIf', cond, block: blok });

const elseNode = (blok) => fromJS({ type: 'Else', block: blok });

const def = (target, value) => fromJS(value ? { type: 'Def', target, value } :
  { type: 'Def', target });

const macro = (symbol, value) => fromJS({ type: 'Macro', symbol, value });

const map = (...properties) => fromJS({ type: 'MapLiteral', properties, js: false });

const mapDestructuring = (...properties) => fromJS({ type: 'MapDestructuring', properties });

const array = (...values) => fromJS({ type: 'ArrayLiteral', values, js: false });

const arrayDestructuring = (...values) => fromJS({ type: 'ArrayDestructuring', values });

const property = (key, value) => fromJS({ type: 'Property', key, value });

const boolean = (value) => fromJS({ type: 'BooleanLiteral', value });

const string = (value) => fromJS({ type: 'StringLiteral', value });

const number = (value) => fromJS({ type: 'NumberLiteral', value });

const stringInterpolation = (...parts) => fromJS({ type: 'StringInterpolation', parts });

const tryCatch = (tryBlock, errorSymbol, catchBlock, finallyBlock = null) => fromJS({
  type: 'TryCatch',
  tryBlock,
  errorSymbol,
  catchBlock,
  finallyBlock
});

const functionCall = (...args) => fromJS({ type: 'FunctionCall', args });

const functionCallWithBody = (args = [], blok = block()) =>
  functionCall(...args).set('block', blok);

const valueSeq = (...values) => fromJS({ type: 'ValueSequence', values });

const getProperty = (attrib) => fromJS({ type: 'GetProperty', attrib });

const getPropertyDynamic = (attrib) => fromJS({ type: 'GetPropertyDynamic', attrib });

const infix = (left, operator, right) => fromJS({
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

const negate = (expr) => fromJS({ type: 'NegatedExpression', target: expr });

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

const quoteWithExpression = (expression) => fromJS({ type: 'Quote', expression });
const quoteWithBlock = (blok) => fromJS({ type: 'Quote', block: blok });

const unquote = (expression) => fromJS({ type: 'Unquote', expression });

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
  mapDestructuring,
  map,
  arrayDestructuring,
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
  negate,
  literal,
  quoteWithExpression,
  quoteWithBlock,
  unquote
};

module.exports = {
  nodeType,
  prewalk,
  doneWalking,
  postwalk,
  prepostwalk,
  dsl
};
