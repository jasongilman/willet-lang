const _ = require('lodash');
const Immutable = require('immutable');
const { fromJS, List } = Immutable;
const { l1, l2, getRecordKeys } = require('./ast');

const doneWalking = (node) => fromJS({ __special: 'DoneWalking', node });
const isDone = (node) => node.get && node.get('__special') === 'DoneWalking';

const visitKeys = (context, preVisitor, postVisitor, walkFn, node, keys) =>
  keys.reduce((n, key) => {
    const value = n.get(key);
    if (List.isList(value)) {
      n = n.set(key, value.flatMap((child) => {
        const result = walkFn(context, preVisitor, postVisitor, child);
        if (!List.isList(result)) {
          return List([result]);
        }
        return result;
      }));
    }
    else if (!_.isNil(value) && value.get && value.get('_type')) {
      n = n.set(key, walkFn(context, preVisitor, postVisitor, value));
    }
    return n;
  }, node);

const nodeType = (node, defaultVal = null) =>
  ((node && node.get) ? node.get('_type', defaultVal) : defaultVal);

const isTypeMaker = (type) => (n) => nodeType(n) === type;

const isHelpers = _(_.concat(_.keys(l1), _.keys(l2)))
  .map((k) => [`is${k}`, isTypeMaker(k)])
  .fromPairs()
  .value();

const isFnCallValueSeq = (node) => {
  if (isHelpers.isValueSequence(node)) {
    const values = node.get('values');
    return values.count() >= 2 &&
      isHelpers.isReference(values.first()) &&
      isHelpers.isFunctionCall(values.last());
  }
  return false;
};

const DEBUG = false;

const debug = (...args) => {
  if (DEBUG) {
    console.log(...args);
  }
};

const prepostwalk = (context, preVisitor, postVisitor, node) => {
  try {
    context.depth = _.get(context, 'depth', -1) + 1;
    debug(`Depth ${context.depth}: PrePostwalk visiting:`, node);
    let beforeVisitNode = node;
    node = preVisitor(context, node);

    if (DEBUG) {
      if (!beforeVisitNode.equals(node)) {
        console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
        console.log('Modified the node with preVisitor');
        console.log('before:', beforeVisitNode);
        console.log(' after:', node);
        console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
      }
    }

    if (isDone(node)) {
      node = node.get('node');
    }
    else {
      const childFields = getRecordKeys(node);

      if (childFields) {
        node = visitKeys(context, preVisitor, postVisitor, prepostwalk, node, childFields);
      }
      beforeVisitNode = node;
      node = postVisitor(context, node);

      if (DEBUG) {
        if (!beforeVisitNode.equals(node)) {
          console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
          debug('Modified the node with postVisitor');
          console.log('before:', beforeVisitNode);
          console.log(' after:', node);
          console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
        }
      }
    }
    return node;
  }
  catch (error) {
    if (error.path) {
      // Must check this because errors are sometimes from filesystem with a string path.
      if (error.path.unshift) {
        error.path.unshift(nodeType(node, 'UNKNOWN'));
      }
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

const prewalk = (context, visitor, node) =>
  prepostwalk(context, visitor, (c, n) => n, node);

const postwalk = (context, visitor, node) =>
  prepostwalk(context, (c, n) => n, visitor, node);


////////////////////////////////////////////////////////////////////////////////////////////////////
// AST DSL

const program = (...statements) => l1.Program({ statements });

const block = (...statements) => l1.Block({ statements });

const spread = (item) => l1.Spread({ item });

const restAssignment = (item) => l1.RestAssignment({ item });

const reference = (symbol) => l1.Reference({ symbol });

const def = (defType, target, value = null, annotation = null) => l1.Def({
  defType, target, value, annotation
});

const boolean = (value) => l1.BooleanLiteral({ value });

const string = (value) => l1.StringLiteral({ value });

const number = (value) => l1.NumberLiteral({ value });

const immutableLiteral = (value) => l1.ImmutableLiteral({ value });

const stringInterpolation = (...parts) => l1.StringInterpolation({ parts });

const map = (...properties) => l1.MapLiteral({ properties, js: false });

const property = (key, value) => l1.Property({ key, value });

const annotationMap = (...properties) => l1.AnnotationMap({ properties });

const singleAnnotation = (symbol) => annotationMap(property(symbol, boolean(true)));

const withAnnotation = (node, annotation) =>
  (annotation ? l1.AnnotatedNode({ node, annotation }) : node);

const array = (...values) => l1.ArrayLiteral({ values, js: false });

const set = (...values) => l1.SetLiteral({ values, js: false });

const list = (...values) => l1.ListLiteral({ values, js: false });

const functionCall = (...args) => l1.FunctionCall({ args });

const functionCallWithBody = (args = [], blok = block()) =>
  functionCall(...args).set('block', blok);

const valueSeq = (...values) => l1.ValueSequence({ values });

const getProperty = (attrib) => l1.GetProperty({ attrib });

const getPropertyImmutable = (attrib) => l1.GetPropertyImmutable({ attrib });

const getPropertyDynamic = (attrib) => l1.GetPropertyDynamic({ attrib });

const infix = (left, operator, right) => l1.InfixExpression({ operator, left, right });

const plus = (left, right) => infix(left, '+', right);
const minus = (left, right) => infix(left, '-', right);
const multiply = (left, right) => infix(left, '*', right);
const divide = (left, right) => infix(left, '/', right);
const modulus = (left, right) => infix(left, '%', right);
const lessThan = (left, right) => infix(left, '<', right);
const greaterThan = (left, right) => infix(left, '>', right);
const lessThanOrEqual = (left, right) => infix(left, '<=', right);
const greaterThanOrEqual = (left, right) => infix(left, '>=', right);
const arrow = (left, right) => infix(left, '=>', right);
const equal = (left, right) => infix(left, '==', right);
const notEqual = (left, right) => infix(left, '!=', right);
const and = (left, right) => infix(left, '&&', right);
const or = (left, right) => infix(left, '||', right);

const unary = (operator, expr) => l1.UnaryExpression({ operator, target: expr });

const negate = (expr) => unary('!', expr);
const newUnary = (expr) => unary('new', expr);
const awaitUnary = (expr) => unary('await', expr);
const throwUnary = (expr) => unary('throw', expr);

// Helper to convert any value into a literal representation
const literal = (value) => {
  let node;
  if (_.isNil(value)) {
    node = l1.Null;
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

// L2 helpers

const mapDestructuring = (...properties) => l2.MapDestructuring({ properties });
const arrayDestructuring = (...values) => l2.ArrayDestructuring({ values });

const func = (args = [], blok = block(), async = false) => l2.Function({
  async,
  args,
  block: blok
});

const funcArg = (arg, theDefault = null) => l2.FunctionArgument({ arg, theDefault });

const macro = (symbol, value) => l2.Macro({ symbol, value });

const ifList = (...items) => l2.IfList({ items });
const ifNode = (cond, blok) => l2.If({ cond, block: blok });
const elseIfNode = (cond, blok) => l2.ElseIf({ cond, block: blok });
const elseNode = (blok) => l2.Else({ block: blok });

const tryCatch = (tryBlock, errorArg, catchBlock, finallyBlock = null) => l2.TryCatch({
  tryBlock,
  errorArg,
  catchBlock,
  finallyBlock
});

const quote = (value) => l2.Quote({ value });

const unquote = (value) => l2.Unquote({ value });

const staticJs = (code) => valueSeq(reference('staticjs'), functionCall(string(code)));

const dsl = {
  Null: l1.Null,
  Undefined: l1.Undefined,
  program,
  block,
  spread,
  restAssignment,
  def,
  map,
  array,
  annotationMap,
  singleAnnotation,
  withAnnotation,
  set,
  list,
  property,
  reference,
  string,
  boolean,
  number,
  immutableLiteral,
  stringInterpolation,
  functionCall,
  functionCallWithBody,
  valueSeq,
  getProperty,
  getPropertyImmutable,
  getPropertyDynamic,
  infix,
  unary,
  negate,
  newUnary,
  awaitUnary,
  throwUnary,
  literal,
  plus,
  minus,
  multiply,
  divide,
  modulus,
  lessThan,
  greaterThan,
  lessThanOrEqual,
  greaterThanOrEqual,
  arrow,
  equal,
  notEqual,
  and,
  or,

  // L2
  mapDestructuring,
  arrayDestructuring,
  func,
  funcArg,
  macro,
  ifList,
  ifNode,
  elseIfNode,
  elseNode,
  tryCatch,
  unquote,
  quote,
  staticJs
};

module.exports = _.merge(
  {},
  isHelpers,
  {
    nodeType,
    isFnCallValueSeq,
    prewalk,
    doneWalking,
    postwalk,
    prepostwalk,
    dsl
  }
);
