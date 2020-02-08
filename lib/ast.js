const _ = require('lodash');
const Immutable = require('immutable');
const { List, Record } = Immutable;

const arrayToList = (v) => {
  if (_.isArray(v)) {
    v = List(v);
  }
  return v;
};

const AdvancedRecord = (defaults) => {
  const keys = List(_.keys(defaults));
  const keySet = new Immutable.Set(keys);

  defaults = _.mapValues(defaults, arrayToList);
  const NewType = Record(defaults);
  NewType.keys = keys;

  const NewTypeWrapper = (values) => {
    const unknownKeys = _.filter(_.keys(values), (k) => !keySet.has(k));

    if (!_.isEmpty(unknownKeys)) {
      throw new Error(`Unsupported keys ${unknownKeys}`);
    }
    return NewType(_.mapValues(values, arrayToList));
  };
  return NewTypeWrapper;
};

const getRecordKeys = (rec) => rec.__proto__.constructor.keys;

// Level 1 - simple AST structures from parsing
const Null = AdvancedRecord({ type: 'Null' })();
const Undefined = AdvancedRecord({ type: 'Undefined' })();
const Program = AdvancedRecord({ type: 'Program', statements: [] });
const Block = AdvancedRecord({ type: 'Block', statements: [] });
const Spread = AdvancedRecord({ type: 'Spread', item: null });
const RestAssignment = AdvancedRecord({ type: 'RestAssignment', item: null });
const Reference = AdvancedRecord({ type: 'Reference', symbol: null });
const Assignment = AdvancedRecord({ type: 'Assignment', target: null, value: null });
const Def = AdvancedRecord({
  type: 'Def', defType: null, target: null, value: null
});
const MapLiteral = AdvancedRecord({ type: 'MapLiteral', properties: [], js: false });
const Property = AdvancedRecord({ type: 'Property', key: null, value: null });
const ArrayLiteral = AdvancedRecord({ type: 'ArrayLiteral', values: [], js: false });
const SetLiteral = AdvancedRecord({ type: 'SetLiteral', values: [], js: false });
const ListLiteral = AdvancedRecord({ type: 'ListLiteral', values: [], js: false });
const BooleanLiteral = AdvancedRecord({ type: 'BooleanLiteral', value: null });
const StringLiteral = AdvancedRecord({ type: 'StringLiteral', value: null });
const NumberLiteral = AdvancedRecord({ type: 'NumberLiteral', value: null });
const StringInterpolation = AdvancedRecord({ type: 'StringInterpolation', parts: [] });
const ValueSequence = AdvancedRecord({ type: 'ValueSequence', values: null });
const GetProperty = AdvancedRecord({ type: 'GetProperty', attrib: null });
const GetPropertyDynamic = AdvancedRecord({ type: 'GetPropertyDynamic', attrib: null });
const InfixExpression = AdvancedRecord({
  type: 'InfixExpression', operator: null, left: null, right: null
});
const NegatedExpression = AdvancedRecord({ type: 'NegatedExpression', target: null });
const FunctionCall = AdvancedRecord({ type: 'FunctionCall', args: [], block: null });

// Level 2 - Semantics applied to level 1

const Function = AdvancedRecord({
  type: 'Function', args: [], block: null, async: false
});

const IfList = AdvancedRecord({ type: 'IfList', items: [] });
const If = AdvancedRecord({ type: 'If', cond: null, block: null });
const ElseIf = AdvancedRecord({ type: 'ElseIf', cond: null, block: null });
const Else = AdvancedRecord({ type: 'Else', block: null });

// TODO should value be function here?
const Macro = AdvancedRecord({ type: 'Macro', symbol: null, value: null });

const MapDestructuring = AdvancedRecord({ type: 'MapDestructuring', properties: [] });
const ArrayDestructuring = AdvancedRecord({ type: 'ArrayDestructuring', values: [] });

const Quote = AdvancedRecord({ type: 'Quote', args: [], block: null });
const Unquote = AdvancedRecord({ type: 'Unquote', args: [], block: null });

const TryCatch = AdvancedRecord({
  type: 'TryCatch',
  tryBlock: null,
  errorSymbol: null,
  catchBlock: null,
  finallyBlock: null
});

module.exports = {
  getRecordKeys,
  l1: {
    Null,
    Undefined,
    Program,
    Block,
    Spread,
    RestAssignment,
    Reference,
    Assignment,
    Def,
    MapLiteral,
    Property,
    ArrayLiteral,
    SetLiteral,
    ListLiteral,
    BooleanLiteral,
    StringLiteral,
    NumberLiteral,
    StringInterpolation,
    ValueSequence,
    GetProperty,
    GetPropertyDynamic,
    InfixExpression,
    NegatedExpression,
    FunctionCall
  },
  l2: {
    Function,
    IfList,
    If,
    ElseIf,
    Else,
    Macro,
    MapDestructuring,
    ArrayDestructuring,
    Quote,
    Unquote,
    TryCatch
  }
};
