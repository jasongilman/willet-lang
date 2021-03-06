const _ = require('lodash');
const Immutable = require('immutable');
const { List, Record } = Immutable;
const Map = Immutable.Map;

const arrayToList = (v) => {
  if (_.isArray(v)) {
    v = List(v);
  }
  return v;
};

const AdvancedRecord = (defaults) => {
  defaults.pos = null;
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
  NewTypeWrapper.keys = keys;
  return NewTypeWrapper;
};

// Level 1 - simple AST structures from parsing
const AnnotationMap = AdvancedRecord({ _type: 'AnnotationMap', properties: [] });
const AnnotatedNode = AdvancedRecord({ _type: 'AnnotatedNode', node: null, annotation: null });

const Null = AdvancedRecord({ _type: 'Null' })();
const Undefined = AdvancedRecord({ _type: 'Undefined' })();
const Program = AdvancedRecord({ _type: 'Program', statements: [] });
const Block = AdvancedRecord({ _type: 'Block', statements: [], solo: true });
const Spread = AdvancedRecord({ _type: 'Spread', item: null });
const RestAssignment = AdvancedRecord({ _type: 'RestAssignment', item: null });
const Reference = AdvancedRecord({ _type: 'Reference', symbol: null });
const Def = AdvancedRecord({
  _type: 'Def', defType: null, target: null, value: null, annotation: null
});
const MapLiteral = AdvancedRecord({ _type: 'MapLiteral', properties: [], js: false });
const Property = AdvancedRecord({ _type: 'Property', key: null, value: null });
const ArrayLiteral = AdvancedRecord({ _type: 'ArrayLiteral', values: [], js: false });
const SetLiteral = AdvancedRecord({ _type: 'SetLiteral', values: [], js: false });
const ListLiteral = AdvancedRecord({ _type: 'ListLiteral', values: [], js: false });
const BooleanLiteral = AdvancedRecord({ _type: 'BooleanLiteral', value: null });
const StringLiteral = AdvancedRecord({ _type: 'StringLiteral', value: null });
const NumberLiteral = AdvancedRecord({ _type: 'NumberLiteral', value: null });

// This represents a collection of immutable data.
const ImmutableLiteral = AdvancedRecord({ _type: 'ImmutableLiteral', value: null });

const StringInterpolation = AdvancedRecord({ _type: 'StringInterpolation', parts: [] });
const ValueSequence = AdvancedRecord({ _type: 'ValueSequence', values: null });
const GetProperty = AdvancedRecord({ _type: 'GetProperty', attrib: null });
const GetPropertyImmutable = AdvancedRecord({ _type: 'GetPropertyImmutable', attrib: null });
const GetPropertyDynamic = AdvancedRecord({ _type: 'GetPropertyDynamic', attrib: null });
const InfixExpression = AdvancedRecord({
  _type: 'InfixExpression', operator: null, left: null, right: null
});
const UnaryExpression = AdvancedRecord({ _type: 'UnaryExpression', operator: null, target: null });
const FunctionCall = AdvancedRecord({ _type: 'FunctionCall', args: [], block: null });

// Level 2 - Semantics applied to level 1

const Function = AdvancedRecord({
  _type: 'Function', args: [], block: null, async: false
});

const FunctionArgument = AdvancedRecord({
  _type: 'FunctionArgument', arg: null, theDefault: undefined
});

const IfList = AdvancedRecord({ _type: 'IfList', items: [] });
const If = AdvancedRecord({ _type: 'If', cond: null, block: null });
const ElseIf = AdvancedRecord({ _type: 'ElseIf', cond: null, block: null });
const Else = AdvancedRecord({ _type: 'Else', block: null });

// FUTURE should value be function here?
const Macro = AdvancedRecord({ _type: 'Macro', symbol: null, value: null });

const MapDestructuring = AdvancedRecord({ _type: 'MapDestructuring', properties: [] });
const ArrayDestructuring = AdvancedRecord({ _type: 'ArrayDestructuring', values: [] });

const Quote = AdvancedRecord({ _type: 'Quote', value: null });
const Unquote = AdvancedRecord({ _type: 'Unquote', value: null });

const TryCatch = AdvancedRecord({
  _type: 'TryCatch',
  tryBlock: null,
  errorArg: null,
  catchBlock: null,
  finallyBlock: null
});

const l1 = {
  AnnotationMap,
  AnnotatedNode,
  Null,
  Undefined,
  Program,
  Block,
  Spread,
  RestAssignment,
  Reference,
  Def,
  MapLiteral,
  Property,
  ArrayLiteral,
  SetLiteral,
  ListLiteral,
  BooleanLiteral,
  StringLiteral,
  NumberLiteral,
  ImmutableLiteral,
  StringInterpolation,
  ValueSequence,
  GetProperty,
  GetPropertyImmutable,
  GetPropertyDynamic,
  InfixExpression,
  UnaryExpression,
  FunctionCall
};

const l2 = {
  Function,
  FunctionArgument,
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
};

const getRecordKeys = (rec) => {
  if (Map.isMap(rec)) {
    const type = rec.get('_type');
    if (!type) {
      console.log('Bad record:', rec);
      throw new Error('record is not an AST record:');
    }
    return (l1[type] || l2[type]).keys;
  }
  return rec.__proto__.constructor.keys;
};

const hasKey = (rec, key) => getRecordKeys(rec).includes(key);

module.exports = {
  getRecordKeys,
  hasKey,
  l1,
  l2
};
