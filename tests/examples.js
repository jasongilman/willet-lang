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
    'fn () {}',
    dsl.func(),
    '() => {\n}'
  ],
  [
    'Arg default values',
    'fn (a = 5 b=foo()) {}',
    dsl.func([
      dsl.funcArg(dsl.reference('a'), dsl.number(5)),
      dsl.funcArg(dsl.reference('b'), dsl.valueSeq(dsl.reference('foo'), dsl.functionCall()))
    ]),
    '(a = 5, b = foo()) => {\n}'
  ],
  [
    'Async function definition using macro',
    'afn() {}',
    dsl.valueSeq(
      dsl.reference('afn'),
      dsl.functionCallWithBody()
    ),
    'async () => {\n}'
  ],
  [
    'Chaining macro calls',
    'afn() { }.()',
    null,
    '(async () => {\n})()'
  ],
  [
    'Definition and invocation',
    '(fn () { 1 })()',
    dsl.valueSeq(
      dsl.func([], dsl.block(dsl.number(1))),
      dsl.functionCall()
    ),
    '(() => { return 1; })()'
  ],
  [
    'Block by itself - Nothing',
    '{}',
    dsl.soloBlock(),
    'null'
  ],
  [
    'Block by itself - simple value',
    '{1}',
    dsl.soloBlock(dsl.number(1)),
    '(() => { return 1; })()'
  ],
  [
    'Block by itself - multiple lines',
    `{
      let v = 1
      v + 1
      }`,
    dsl.soloBlock(
      dsl.assignment('v', dsl.number(1)),
      dsl.plus(dsl.reference('v'), dsl.number(1))
    ),
    '(() => { (v = 1); return (v + 1); })()'
  ]
);

const assignmentExamples = makeExamples(
  [
    'let a = fn () {}',
    dsl.assignment('a', dsl.func()),
    '(a = () => {\n})'
  ],
  [
    `let a = #{}
     let a.b = fn () {}`,
    [
      dsl.assignment(dsl.reference('a'), dsl.map()),
      dsl.assignment(dsl.valueSeq(dsl.reference('a'), dsl.getProperty('b')), dsl.func())
    ],
    `(a = {});
      (a.b = () => {\n})`
  ],
  [
    'Map destructuring',
    'let #{a} = #{a: "hello"}',
    dsl.assignment(
      dsl.map(dsl.property('a', dsl.reference('a'))),
      dsl.map(dsl.property('a', dsl.string('hello')))
    ),
    '({a: a} = { a: "hello" })'
  ],
  [
    'Array destructuring',
    `let foo = fn () {[1,2]}
    let [a b] = foo()`,
    [
      dsl.assignment(
        dsl.reference('foo'),
        dsl.func([], dsl.block(dsl.array(dsl.number(1), dsl.number(2))))
      ),
      dsl.assignment(
        dsl.array(dsl.reference('a'), dsl.reference('b')),
        dsl.valueSeq(dsl.reference('foo'), dsl.functionCall())
      ),
    ],
    `(foo = () => {
          return [1, 2];
      });
      ([a, b] = foo())`
  ],
  [
    'Comment after assignment',
    'let a = fn () {} // ignored',
    dsl.assignment('a', dsl.func()),
    '(a = () => {\n})'
  ],
  [
    'Multiline comment',
    `let a = fn () {} /* ignored
      / ignored */`,
    dsl.assignment('a', dsl.func()),
    '(a = () => {\n})'
  ]
);

const mapExamples = makeExamples(
  [
    '#{}',
    dsl.map(),
    '{}'
  ],
  [
    '#{a:null}',
    dsl.map(dsl.property('a', dsl.Null)),
    '{ a: null }'
  ],
  [
    '#{b}',
    dsl.map(dsl.property('b', dsl.reference('b'))),
    '{ b: b }'
  ],
  [
    'let a = #{ a: null b: "foo" }',
    dsl.assignment('a', dsl.map(
      dsl.property('a', dsl.Null),
      dsl.property('b', dsl.string('foo'))
    )),
    '(a = { a: null, b: "foo" })'
  ],
  [
    'Map within a map',
    'let a = #{ a: #{ b: "foo" } c: 5 }',
    dsl.assignment('a', dsl.map(
      dsl.property('a', dsl.map(dsl.property('b', dsl.string('foo')))),
      dsl.property('c', dsl.number(5))
    )),
    '(a = { a: { b: "foo" }, c: 5 })'
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
    'let a = [null "foo" ]',
    dsl.assignment('a', dsl.array(
      dsl.Null,
      dsl.string('foo')
    )),
    '(a = [ null, "foo" ])'
  ],
  [
    'Array within a array',
    'let a = [["foo"] 5]',
    dsl.assignment('a', dsl.array(dsl.array(dsl.string('foo')), dsl.number(5))),
    '(a = [["foo"], 5])'
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
    'a.[b]',
    dsl.valueSeq(
      dsl.reference('a'),
      dsl.getPropertyDynamic(dsl.reference('b'))
    ),
    'a[b]'
  ],
  [
    'a(b.c).[d]',
    dsl.valueSeq(
      dsl.reference('a'),
      dsl.functionCall(dsl.valueSeq(dsl.reference('b'), dsl.getProperty('c'))),
      dsl.getPropertyDynamic(dsl.reference('d'))
    ),
    'a(b.c)[d]'
  ],
  [
    'a().().d',
    dsl.valueSeq(
      dsl.reference('a'),
      dsl.functionCall(),
      dsl.functionCall(),
      dsl.getProperty('d'),
    ),
    'a()().d'
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
        dsl.block(dsl.valueSeq(dsl.reference('log'), dsl.functionCall(dsl.string('hello'))))
      )
    ),
    // Don't attempt to test javascript generation. We'll add macro stuff later
    null
  ]
);

const initialTryCatch = (tryBlock, errorSymbol, catchBlock, finallyBlock = null) => _.concat(
  [
    dsl.valueSeq(dsl.reference('try'), dsl.functionCallWithBody([], dsl.block(...tryBlock))),
    dsl.valueSeq(dsl.reference('catch'), dsl.functionCallWithBody(
      [dsl.reference(errorSymbol)], dsl.block(...catchBlock)
    )),
  ],
  finallyBlock ? [
    dsl.valueSeq(
      dsl.reference('finally'),
      dsl.functionCallWithBody([], dsl.block(...finallyBlock))
    )
  ] : []
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
    initialTryCatch(
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
    initialTryCatch(
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

const initialIf = (condition, statements) =>
  dsl.valueSeq(dsl.reference('if'),
    dsl.functionCallWithBody([condition], dsl.block(...statements)));

const initialElse = (statements) =>
  dsl.valueSeq(dsl.reference('else'),
    dsl.functionCallWithBody([], dsl.block(...statements)));

const initialElseIf = (condition, statements) =>
  dsl.valueSeq(dsl.reference('elseif'),
    dsl.functionCallWithBody([condition], dsl.block(...statements)));

const ifExamples = makeExamples(
  [
    'if',
    'if("true") { "a" }',
    [
      initialIf(
        dsl.string('true'),
        [
          dsl.string('a')
        ]
      )
    ],
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
    [
      initialIf(
        dsl.string('true'),
        [
          dsl.string('a'),
          dsl.string('b'),
          dsl.string('c')
        ]
      )
    ],
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
    [
      initialIf(dsl.string('true'), [dsl.string('a')]),
      initialElse([dsl.string('b')])
    ],
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
    'if("true") { "a" } elseif("false") { "c" } else { "b" }',
    [
      initialIf(dsl.string('true'), [dsl.string('a')]),
      initialElseIf(dsl.string('false'), [dsl.string('c')]),
      initialElse([dsl.string('b')])
    ],
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

const condExamples = makeExamples(
  [
    `cond {
      true 1
    }`,
    null,
    `(() => {
        if (true) {
          return 1;
        }
        return null;
    })()`
  ],
  [
    `cond {
      true 1
      else 2
     }`,
    null,
    `(() => {
        if (true) {
          return 1;
        }
        else {
          return 2;
        }
        return null;
    })()`
  ],
  [
    `cond {
      foo() 1
      bar() + 3 > 2 2
      else 3
     }`,
    null,
    `(() => {
        if (foo()) {
          return 1;
        }
        else if (((bar() + 3) > 2)) {
          return 2;
        }
        else {
          return 3;
        }
        return null;
    })()`
  ],
  [
    `cond {
      foo(); { 1 }
      bar() + 3 > 2; { 2 }
      else 3
     }`,
    null,
    `(() => {
        if (foo()) {
          return 1;
        }
        else if (((bar() + 3) > 2)) {
          return 2;
        }
        else {
          return 3;
        }
        return null;
    })()`
  ]
);

const chainExamples = makeExamples(
  [
    `chain(1) {
      a(2)
      b(3)
      c(4)
    }`,
    null,
    'c(b(a(1, 2), 3), 4)'
  ],
  [
    'Chain multiple arguments',
    `chain(1 a) {
      a(2)
      b(3)
      c(4)
    }`,
    null,
    'c(b(a(1, a, 2), 3), 4)'
  ],
  [
    'Chain more complex',
    `chain(1) {
      a(2)
      b(3).(5)
      c
    }`,
    null,
    'c(b(a(1, 2), 3)(5))'
  ],
);

const operatorExamples = makeExamples(
  [
    '1 + 2',
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
    '(1 === 2)'
  ],
  [
    '1 != 2',
    dsl.notEqual(dsl.number(1), dsl.number(2)),
    '(1 !== 2)'
  ],

  [
    'Precedence with comparison and math',
    '1 + 4 < 2 + 3',
    dsl.lessThan(dsl.plus(dsl.number(1), dsl.number(4)), dsl.plus(dsl.number(2), dsl.number(3))),
    '((1 + 4) < (2 + 3))'
  ],
  [
    'foo && bar',
    dsl.and(dsl.reference('foo'), dsl.reference('bar')),
    '(foo && bar)'
  ],
  [
    'foo || bar',
    dsl.or(dsl.reference('foo'), dsl.reference('bar')),
    '(foo || bar)'
  ],
  [
    '!foo',
    dsl.not(dsl.reference('foo')),
    '(!foo)'
  ],
  [
    '!!foo',
    dsl.not(dsl.not(dsl.reference('foo'))),
    '(!(!foo))'
  ],
  [
    '!(foo || bar)',
    dsl.not(dsl.or(dsl.reference('foo'), dsl.reference('bar'))),
    '(!(foo || bar))'
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
    // Let is used here because beautify doesn't work well on a negative by itself.
    'let v = -5',
    dsl.assignment('v', dsl.number(-5)),
    '(v = -5)'
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
    'let v = -5.1',
    dsl.assignment('v', dsl.number(-5.1)),
    '(v = -5.1)'
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
    dsl.def(dsl.reference('a')),
    'let a = null'
  ],
  [
    'def a = 7',
    dsl.def(dsl.reference('a'), dsl.number(7)),
    'let a = 7'
  ],
  [
    'def a = fn (b c) { }',
    dsl.def(dsl.reference('a'),
      dsl.func([dsl.funcArg(dsl.reference('b')), dsl.funcArg(dsl.reference('c'))])),
    'let a = (b, c) => {\n}'
  ],
  [
    'def #{a} = #{ a: 5 }',
    dsl.def(
      dsl.map(dsl.property('a', dsl.reference('a'))),
      dsl.map(dsl.property('a', dsl.number(5))),
    ),
    'let { a: a } = { a: 5 }'
  ],
  [
    'string interpolation',
    '`This {is} ${a} good $${money(b)} \\`not done`',
    dsl.stringInterpolation(
      'This {is} ',
      dsl.reference('a'),
      ' good $',
      dsl.valueSeq(
        dsl.reference('money'),
        dsl.functionCall(dsl.reference('b'))
      ),
      ' \\`not done'
    ),
    '`This {is} ${a} good $${money(b)} \\`not done`'
  ]
);

const quoteExamples = makeExamples(
  [
    'quote(null)',
    dsl.quoteWithExpression(dsl.literal(null)),
    '{ type: "Null" }'
  ],
  [
    'quote(a)',
    dsl.quoteWithExpression(dsl.reference('a')),
    '{ type: "Reference", symbol: "a" }'
  ],
  [
    'quote(a.b)',
    dsl.quoteWithExpression(dsl.valueSeq(dsl.reference('a'), dsl.getProperty('b'))),
    `{
        type: "ValueSequence",
        values: [{ type: "Reference", symbol: "a" }, { type: "GetProperty", attrib: "b" }]
    }`
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
    'Spreading a result',
    'a(...foo(1))',
    dsl.valueSeq(
      dsl.reference('a'),
      dsl.functionCall(
        dsl.spread(
          dsl.valueSeq(
            dsl.reference('foo'),
            dsl.functionCall(dsl.number(1))
          )
        )
      )
    ),
    'a(...foo(1))'
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
    'fn (foo ...more) {}',
    dsl.func([
      dsl.funcArg(dsl.reference('foo')),
      dsl.restAssignment(dsl.funcArg(dsl.reference('more')))
    ]),
    '(foo, ...more) => {}'
  ],
);

const specialJavaScriptOperators = makeExamples(
  [
    'typeof("foo")',
    null,
    'typeof("foo")'
  ],
  [
    'let s = typeof("foo").trim()',
    null,
    '(s = typeof("foo").trim())'
  ],
  [
    'new(Error("foo")).toString()',
    null,
    'new Error("foo").toString()'
  ],
  [
    'instanceof(v Promise).toString()',
    null,
    '(v instanceof Promise).toString()'
  ],
  [
    'throw(new(Error("foo")))',
    null,
    'throw new Error("foo")'
  ],
);

module.exports = {
  functionDeclarationExamples,
  assignmentExamples,
  mapExamples,
  arrayExamples,
  miscExamples,
  ifExamples,
  condExamples,
  chainExamples,
  valueSequenceExamples,
  functionCallExamples,
  tryCatchExamples,
  simpleLiteralExamples,
  operatorExamples,
  quoteExamples,
  spreadExamples,
  specialJavaScriptOperators
};
