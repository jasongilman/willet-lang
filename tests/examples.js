/* eslint-disable no-template-curly-in-string */
const _ = require('lodash');
const dsl = require('../lib/ast-helper').dsl;

////////////////////////////////////////////////////////////////////////////////////////////////////
// Examples are of format
// name (optional)
// willet code
// expected ast
// expected Javascript

const makeExample = (parts) => {
  const name = parts[0];
  let willet;
  let ast;
  let js;
  let _ignore;
  if (parts.length === 3) {
    [willet, ast, js] = parts;
  }
  else {
    [_ignore, willet, ast, js] = parts;
  }
  return {
    name, willet, ast, js
  };
};

const makeExamples = (...examples) => _.map(examples, makeExample);

const functionDeclarationExamples = makeExamples(
  [
    '() => {}',
    dsl.func(),
    '() => {\n}'
  ]
);

const assignmentExamples = makeExamples(
  [
    'a = () => {}',
    dsl.assignment('a', dsl.func()),
    '(a = () => {\n})'
  ],
  [
    'a.b = () => {}',
    dsl.assignment(dsl.valueSeq(dsl.reference('a'), dsl.getProperty('b')), dsl.func()),
    '(a.b = () => {\n})'
  ],
  [
    'Map destructuring',
    '#{a} = #{a: "hello"}',
    dsl.assignment(
      dsl.mapDestructuring(dsl.symbolAssignment('a')),
      dsl.map(dsl.property('a', dsl.string('hello')))
    ),
    '({a} = ({ a: "hello" }))'
  ],
  [
    'Array destructuring',
    '[a b] = foo()',
    dsl.assignment(
      dsl.arrayDestructuring(dsl.symbolAssignment('a'), dsl.symbolAssignment('b')),
      dsl.valueSeq(dsl.reference('foo'), dsl.functionCall())
    ),
    '([a, b] = foo())'
  ],
  [
    'Comment after assignment',
    'a = () => {} // ignored',
    dsl.assignment('a', dsl.func()),
    '(a = () => {\n})'
  ]
);

const mapExamples = makeExamples(
  [
    '#{}',
    dsl.map(),
    '({})'
  ],
  [
    '#{a:null}',
    dsl.map(dsl.property('a', dsl.Null)),
    '({ a: null })'
  ],
  [
    '#{b}',
    dsl.map(dsl.property('b', dsl.reference('b'))),
    '({ b: b })'
  ],
  [
    'a = #{ a: null b: "foo" }',
    dsl.assignment('a', dsl.map(
      dsl.property('a', dsl.Null),
      dsl.property('b', dsl.string('foo'))
    )),
    '(a = ({ a: null, b: "foo" }))'
  ],
  [
    'Map within a map',
    'a = #{ a: #{ b: "foo" } c: d }',
    dsl.assignment('a', dsl.map(
      dsl.property('a', dsl.map(dsl.property('b', dsl.string('foo')))),
      dsl.property('c', dsl.reference('d'))
    )),
    '(a = ({ a: ({ b: "foo" }), c: d }))'
  ]
);

const arrayExamples = makeExamples(
  [
    '[]',
    dsl.array(),
    '[]'
  ],
  [
    '[null]',
    dsl.array(dsl.Null),
    '[ null ]'
  ],
  [
    'a = [null "foo" ]',
    dsl.assignment('a', dsl.array(
      dsl.Null,
      dsl.string('foo')
    )),
    '(a = [ null, "foo" ])'
  ],
  [
    'Array within a array',
    'a = [["foo"]d]',
    dsl.assignment('a', dsl.array(dsl.array(dsl.string('foo')), dsl.reference('d'))),
    '(a = [["foo"], d])'
  ]
);

const valueSequenceExamples = makeExamples(
  [
    'a',
    dsl.reference('a'),
    'a'
  ],
  [
    'a.b',
    dsl.valueSeq(
      dsl.reference('a'),
      dsl.getProperty('b')
    ),
    'a.b'
  ],
  [
    'a[b]',
    dsl.valueSeq(
      dsl.reference('a'),
      dsl.getPropertyDynamic(dsl.reference('b'))
    ),
    'a[b]'
  ],
  [
    'a(b.c)[d]',
    dsl.valueSeq(
      dsl.reference('a'),
      dsl.functionCall(dsl.valueSeq(dsl.reference('b'), dsl.getProperty('c'))),
      dsl.getPropertyDynamic(dsl.reference('d'))
    ),
    'a(b.c)[d]'
  ],
);

const functionCallExamples = makeExamples(
  [
    'Basic',
    'a(b)',
    dsl.valueSeq(
      dsl.reference('a'),
      dsl.functionCall(dsl.reference('b'))
    ),
    'a(b)'
  ],
  [
    'Multiple arguments',
    'a(b "foo")',
    dsl.valueSeq(
      dsl.reference('a'),
      dsl.functionCall(
        dsl.reference('b'),
        dsl.string('foo')
      )
    ),
    'a(b, "foo")'
  ],

  // Function calls with a body are part of the basis of macros
  [
    'With body',
    'foo(b) { log("hello") }',
    dsl.valueSeq(
      dsl.reference('foo'),
      dsl.functionCallWithBody(
        [dsl.reference('b')],
        [dsl.valueSeq(dsl.reference('log'), dsl.functionCall(dsl.string('hello')))]
      )
    ),
    // Don't attempt to test javascript generation. We'll add macro stuff later
    null
  ],
);

const tryCatchExamples = makeExamples(
  [
    'try catch',
    `try {
        f()
      }
      catch (err) {
        err
      }`,
    dsl.tryCatch(
      [dsl.valueSeq(dsl.reference('f'), dsl.functionCall())],
      'err',
      [dsl.reference('err')]
    ),
    `(() => {
      try {
        return f();
      }
      catch (err) {
        return err;
      }

    })()`
  ],
  [
    'try catch finally',
    `try {
        f()
      }
      catch (err) {
        err
      }
      finally {
        foo
      }`,
    dsl.tryCatch(
      [dsl.valueSeq(dsl.reference('f'), dsl.functionCall())],
      'err',
      [dsl.reference('err')],
      [dsl.reference('foo')]
    ),
    `(() => {
      try {
        return f();
      }
      catch (err) {
        return err;
      }
      finally {
        return foo;
      }
    })()`
  ]
);

const ifExamples = makeExamples(
  [
    'if',
    'if("true") { "a" }',
    dsl.ifList(
      dsl.ifNode(
        dsl.string('true'),
        [
          dsl.string('a')
        ]
      )
    ),
    `(() => {
      if("true") {
        return "a";
      }
      return null;
    })()`
  ],
  [
    'if multi-statement',
    'if("true") { "a" "b" "c"}',
    dsl.ifList(
      dsl.ifNode(
        dsl.string('true'),
        [
          dsl.string('a'),
          dsl.string('b'),
          dsl.string('c')
        ]
      )
    ),
    `(() => {
      if("true") {
        "a";
        "b";
        return "c";
      }
      return null;
    })()`
  ],
  [
    'if else',
    'if("true") { "a" } else { "b" }',
    dsl.ifList(
      dsl.ifNode(dsl.string('true'), [dsl.string('a')]),
      dsl.elseNode([dsl.string('b')])
    ),
    `(() => {
      if("true") {
        return "a";
      }
      else {
        return "b";
      }
      return null;
    })()`
  ],
  [
    'if else-if else',
    'if("true") { "a" } else if("false") { "c" } else { "b" }',
    dsl.ifList(
      dsl.ifNode(dsl.string('true'), [dsl.string('a')]),
      dsl.elseIfNode(dsl.string('false'), [dsl.string('c')]),
      dsl.elseNode([dsl.string('b')])
    ),
    `(() => {
      if("true") {
        return "a";
      }
      else if("false") {
        return "c";
      }
      else {
        return "b";
      }
      return null;
    })()`
  ],
);

const operatorExamples = makeExamples(
  [
    '1+2',
    dsl.plus(dsl.number(1), dsl.number(2)),
    '(1 + 2)'
  ],
  [
    '1 + 2',
    dsl.plus(dsl.number(1), dsl.number(2)),
    '(1 + 2)'
  ],
  [
    '1 - 2',
    dsl.minus(dsl.number(1), dsl.number(2)),
    '(1 - 2)'
  ],
  [
    '1 * 2',
    dsl.multiply(dsl.number(1), dsl.number(2)),
    '(1 * 2)'
  ],
  [
    '1 / 2',
    dsl.divide(dsl.number(1), dsl.number(2)),
    '(1 / 2)'
  ],
  [
    '1 % 2',
    dsl.modulus(dsl.number(1), dsl.number(2)),
    '(1 % 2)'
  ],

  // Combining
  [
    '1 + 2 * 3',
    dsl.plus(dsl.number(1), dsl.multiply(dsl.number(2), dsl.number(3))),
    '(1 + (2 * 3))'
  ],
  [
    '1 * 2 + 3',
    dsl.plus(dsl.multiply(dsl.number(1), dsl.number(2)), dsl.number(3)),
    '((1 * 2) + 3)'
  ],
  // parentheses
  [
    '1 * (2 + 3)',
    dsl.multiply(dsl.number(1), dsl.plus(dsl.number(2), dsl.number(3))),
    '(1 * (2 + 3))'
  ],
  [
    '(1 * (2 + 3))',
    dsl.multiply(dsl.number(1), dsl.plus(dsl.number(2), dsl.number(3))),
    '(1 * (2 + 3))'
  ],
  [
    '(1 * 2) + 3',
    dsl.plus(dsl.multiply(dsl.number(1), dsl.number(2)), dsl.number(3)),
    '((1 * 2) + 3)'
  ],

  // Comparison operators
  [
    '1<2',
    dsl.lessThan(dsl.number(1), dsl.number(2)),
    '(1 < 2)'
  ],
  [
    '1 < 2',
    dsl.lessThan(dsl.number(1), dsl.number(2)),
    '(1 < 2)'
  ],
  [
    '1 > 2',
    dsl.greaterThan(dsl.number(1), dsl.number(2)),
    '(1 > 2)'
  ],
  [
    '1 <= 2',
    dsl.lessThanOrEqual(dsl.number(1), dsl.number(2)),
    '(1 <= 2)'
  ],
  [
    '1 >= 2',
    dsl.greaterThanOrEqual(dsl.number(1), dsl.number(2)),
    '(1 >= 2)'
  ],
  [
    '1 == 2',
    dsl.equal(dsl.number(1), dsl.number(2)),
    '(1 == 2)'
  ],
  [
    '1 != 2',
    dsl.notEqual(dsl.number(1), dsl.number(2)),
    '(1 != 2)'
  ],

  [
    'Precedence with comparison and math',
    '1 + 4 < 2 + 3',
    dsl.lessThan(dsl.plus(dsl.number(1), dsl.number(4)), dsl.plus(dsl.number(2), dsl.number(3))),
    '((1 + 4) < (2 + 3))'
  ],
);

const simpleLiteralExamples = makeExamples(
  [
    '"a string"',
    dsl.string('a string'),
    '"a string"'
  ],
  [
    'null',
    dsl.Null,
    'null'
  ],
  // Integers
  [
    '5',
    dsl.number(5),
    '5'
  ],
  [
    '12345',
    dsl.number(12345),
    '12345'
  ],
  [
    '-5',
    dsl.number(-5),
    '-5'
  ],
  [
    '+5',
    dsl.number(5),
    '5'
  ],
  // Floats
  [
    '5.0',
    dsl.number(5),
    '5'
  ],
  [
    '5.123',
    dsl.number(5.123),
    '5.123'
  ],
  [
    '-5.1',
    dsl.number(-5.1),
    '-5.1'
  ],
  [
    '+5.1',
    dsl.number(5.1),
    '5.1'
  ],
);

const miscExamples = makeExamples(
  [
    'def a',
    dsl.def(dsl.symbolAssignment('a')),
    'let a = null'
  ],
  [
    'def a = 7',
    dsl.def(dsl.symbolAssignment('a'), dsl.number(7)),
    'let a = 7'
  ],
  [
    'def a = (b c) => { }',
    dsl.def(dsl.symbolAssignment('a'),
      dsl.func([dsl.symbolAssignment('b'), dsl.symbolAssignment('c')])),
    'let a = (b, c) => {\n}'
  ],
  [
    'def #{a} = foo',
    dsl.def(dsl.mapDestructuring(dsl.symbolAssignment('a')), dsl.reference('foo')),
    'let { a } = foo'
  ],
  [
    'string interpolation',
    '`This is ${a} good $${money(b)} \\`not done`',
    dsl.stringInterpolation(
      'This is ',
      dsl.reference('a'),
      ' good $',
      dsl.valueSeq(
        dsl.reference('money'),
        dsl.functionCall(dsl.reference('b'))
      ),
      ' \\`not done'
    ),
    '`This is ${a} good $${money(b)} \\`not done`'
  ]
);

const quoteExamples = makeExamples(
  [
    'quote(null)',
    dsl.quoteWithExpression(dsl.literal(null)),
    '({ type: "Null" })'
  ],
  [
    'quote(a)',
    dsl.quoteWithExpression(dsl.reference('a')),
    '({ type: "Reference", symbol: "a" })'
  ],
  [
    'quote(a.b)',
    dsl.quoteWithExpression(dsl.valueSeq(dsl.reference('a'), dsl.getProperty('b'))),
    `({
        type: "ValueSequence",
        values: [({ type: "Reference", symbol: "a" }), ({ type: "GetProperty", attrib: "b" })]
    })`
  ],
);

const spreadExamples = makeExamples(
  [
    'Calling a function',
    'a(foo ...some thing ...more)',
    dsl.valueSeq(
      dsl.reference('a'),
      dsl.functionCall(
        dsl.reference('foo'),
        dsl.spread(dsl.reference('some')),
        dsl.reference('thing'),
        dsl.spread(dsl.reference('more'))
      )
    ),
    'a(foo, ...some, thing, ...more)'
  ],
  [
    'Array literal',
    '[foo ...some thing ...more]',
    dsl.array(
      dsl.reference('foo'),
      dsl.spread(dsl.reference('some')),
      dsl.reference('thing'),
      dsl.spread(dsl.reference('more'))
    ),
    '[foo, ...some, thing, ...more]'
  ],
  [
    'Function declaration',
    '(foo ...more) => {}',
    dsl.func([dsl.symbolAssignment('foo'), dsl.restAssignment('more')]),
    '(foo, ...more) => {}'
  ],
);

module.exports = {
  functionDeclarationExamples,
  assignmentExamples,
  mapExamples,
  arrayExamples,
  miscExamples,
  ifExamples,
  valueSequenceExamples,
  functionCallExamples,
  tryCatchExamples,
  simpleLiteralExamples,
  operatorExamples,
  quoteExamples,
  spreadExamples
};
