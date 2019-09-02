const _ = require('lodash');


const func = () => ({
  type: 'Function',
  async: false,
  arguments: null,
  statements: []
});


const symbolAssignment = (symbol) => ({ type: 'SymbolAssignment', symbol });

const assignment = (target, value) => {
  if (_.isString(target)) {
    target = symbolAssignment(target)
  }
  return {
    type: 'Assignment', target, value
  };
};

const Null = { type: "Null" };

const ifList = (...items) => ({ type: "IfList", items });

const ifNode = (cond, block) => ({ type: "If", cond, block });

const elseIfNode = (cond, block) => ({ type: "ElseIf", cond, block });

const elseNode = (block) => ({ type: "Else", block });

const mapDestructuring = (...targets) => ({ type: 'MapDestructuring', targets });

const def = (symbol) => ({ type: "Def", symbol });

const map = (...properties) => ({ type: "MapLiteral", properties });

const property = (key, value) => ({ type: "Property", key, value });

const reference = (symbol) => ({ type: "Reference", symbol });

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

const functionCall = (...arguments) => ({ type: 'FunctionCall', arguments });

const functionCallWithBody = (arguments, bodyStmts) => {
  const fn = functionCall(...arguments);
  fn.block = bodyStmts;
  return fn;
};

const valueSeq = (...values) => ({ type: 'ValueSequence', values });

const getProperty = (attrib) => ({ type: "GetProperty", attrib });

const getPropertyDynamic = (attrib) => ({ type: "GetPropertyDynamic", attrib });

const infix = (left, operator, right) => ({ type: 'InfixExpression', operator, left, right});
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

////////////////////////////////////////////////////////////////////////////////////////////////////
// Examples are of format
// name (optional)
// willet code
// expected ast
// expected Javascript

const makeExample = (parts) => {
  const name = parts[0]
  let willet;
  let ast;
  let js;
  if (parts.length === 3) {
    [willet, ast, js] = parts;
  }
  else {
    [_ignore, willet, ast, js] = parts;
  }
  return { name, willet, ast, js };
};

const makeExamples = (...examples) => _.map(examples, makeExample);

const functionDeclarationExamples = makeExamples(
  [
    '() => {}',
    func(),
    '() => {\n\n}'
  ]
);

const assignmentExamples = makeExamples(
  [
    'a = () => {}',
    assignment('a', func()),
    '(a = () => {\n\n})'
  ],
  [
    'Map destructuring',
    '#{a} = #{a: "hello"}',
    assignment(
      mapDestructuring(symbolAssignment('a')),
      map(property('a', string("hello")))
    ),
    '({a} = { a: "hello" })',
  ],
  [
    'Comment after assignment',
    'a = () => {} // ignored',
    assignment('a', func()),
    '(a = () => {\n\n})',
  ]
);

const mapExamples = makeExamples(
  [
    '#{}',
    map(),
    '{}'
  ],
  [
    '#{a:null}',
    map(property('a', Null)),
    '{ a: null }'
  ],
  [
    'a = #{ a: null b: "foo" }',
    assignment('a', map(
      property('a', Null),
      property('b', string('foo'))
    )),
    '(a = { a: null, b: "foo" })'
  ],
  [
    'Map within a map',
    'a = #{ a: #{ b: "foo" } c: d }',
    assignment('a', map(
      property('a', map(property('b', string('foo')))),
      property('c', reference('d'))
    )),
    '(a = { a: { b: "foo" }, c: d })',
  ]
);

const valueSequenceExamples = makeExamples(
  [
    'a',
    reference('a'),
    'a'
  ],
  [
    'a.b',
    valueSeq(
      reference('a'),
      getProperty('b')
    ),
    'a.b'
  ],
  [
    'a[b]',
    valueSeq(
      reference('a'),
      getPropertyDynamic(reference('b'))
    ),
    'a[b]'
  ],
  [
    'a(b.c)[d]',
    valueSeq(
      reference('a'),
      functionCall(valueSeq(reference('b'), getProperty('c'))),
      getPropertyDynamic(reference('d'))
    ),
    'a(b.c)[d]'
  ],
);

const functionCallExamples = makeExamples(
  [
    'Basic',
    'a(b)',
    valueSeq(
      reference('a'),
      functionCall(reference('b'))
    ),
    'a(b)'
  ],
  [
    'Multiple arguments',
    'a(b "foo")',
    valueSeq(
      reference('a'),
      functionCall(
        reference('b'),
        string("foo")
      )
    ),
    'a(b, "foo")'
  ],

  // Function calls with a body are part of the basis of macros
  [
    'With body',
    'foo(b) { log("hello") }',
    valueSeq(
      reference('foo'),
      functionCallWithBody(
        [reference('b')],
        [valueSeq(reference('log'), functionCall(string('hello')))]
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
    tryCatch(
      [valueSeq(reference('f'), functionCall())],
      'err',
      [reference('err')]
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
    tryCatch(
      [valueSeq(reference('f'), functionCall())],
      'err',
      [reference('err')],
      [reference('foo')]
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
    ifList(
      ifNode(
        string("true"),
        [
          string("a")
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
    ifList(
      ifNode(
        string("true"),
        [
          string("a"),
          string("b"),
          string("c"),
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
    ifList(
      ifNode(string("true"), [string("a")]),
      elseNode([string("b")])
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
    ifList(
      ifNode(string("true"), [string("a")]),
      elseIfNode(string("false"), [string("c")]),
      elseNode([string("b")])
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
    "1+2",
    plus(number(1), number(2)),
    "(1 + 2)"
  ],
  [
    "1 + 2",
    plus(number(1), number(2)),
    "(1 + 2)"
  ],
  [
    "1 - 2",
    minus(number(1), number(2)),
    "(1 - 2)"
  ],
  [
    "1 * 2",
    multiply(number(1), number(2)),
    "(1 * 2)"
  ],
  [
    "1 / 2",
    divide(number(1), number(2)),
    "(1 / 2)"
  ],
  [
    "1 % 2",
    modulus(number(1), number(2)),
    "(1 % 2)"
  ],

  // Combining
  [
    "1 + 2 * 3",
    plus(number(1), multiply(number(2), number(3))),
    "(1 + (2 * 3))"
  ],
  [
    "1 * 2 + 3",
    plus(multiply(number(1), number(2)), number(3) ),
    "((1 * 2) + 3)"
  ],
  // parentheses
  [
    "1 * (2 + 3)",
    multiply(number(1), plus(number(2), number(3))),
    "(1 * (2 + 3))"
  ],
  [
    "(1 * (2 + 3))",
    multiply(number(1), plus(number(2), number(3))),
    "(1 * (2 + 3))"
  ],
  [
    "(1 * 2) + 3",
    plus(multiply(number(1), number(2)), number(3) ),
    "((1 * 2) + 3)"
  ],

  // Comparison operators
  [
    "1<2",
    lessThan(number(1), number(2)),
    "(1 < 2)"
  ],
  [
    "1 < 2",
    lessThan(number(1), number(2)),
    "(1 < 2)"
  ],
  [
    "1 > 2",
    greaterThan(number(1), number(2)),
    "(1 > 2)"
  ],
  [
    "1 <= 2",
    lessThanOrEqual(number(1), number(2)),
    "(1 <= 2)"
  ],
  [
    "1 >= 2",
    greaterThanOrEqual(number(1), number(2)),
    "(1 >= 2)"
  ],
  [
    "1 == 2",
    equal(number(1), number(2)),
    "(1 == 2)"
  ],
  [
    "1 != 2",
    notEqual(number(1), number(2)),
    "(1 != 2)"
  ],

  [
    "Precedence with comparison and math",
    "1 + 4 < 2 + 3",
    lessThan(plus(number(1), number(4)), plus(number(2), number(3))),
    "((1 + 4) < (2 + 3))"
  ],
);

const simpleLiteralExamples = makeExamples(
  [
    '"a string"',
    string('a string'),
    '"a string"'
  ],
  [
    'null',
    Null,
    'null'
  ],
  // Integers
  [
    '5',
    number(5),
    '5'
  ],
  [
    '12345',
    number(12345),
    '12345'
  ],
  [
    '-5',
    number(-5),
    '-5'
  ],
  [
    '+5',
    number(5),
    '5'
  ],
  // Floats
  [
    '5.0',
    number(5),
    '5'
  ],
  [
    '5.123',
    number(5.123),
    '5.123'
  ],
  [
    '-5.1',
    number(-5.1),
    '-5.1'
  ],
  [
    '+5.1',
    number(5.1),
    '5.1'
  ],
);

const miscExamples = makeExamples(
  [
    'def a',
    def('a'),
    'let a'
  ],
  [
    'string interpolation',
    "`This is ${a} good $${money(b)} \\`not done`",
    stringInterpolation(
      "This is ",
      reference('a'),
      " good $",
      valueSeq(
        reference('money'),
        functionCall(reference('b'))
      ),
      " \\`not done"
    ),
    "`This is ${a} good $${money(b)} \\`not done`",
  ]
);


module.exports = {
  functionDeclarationExamples,
  assignmentExamples,
  mapExamples,
  miscExamples,
  ifExamples,
  valueSequenceExamples,
  functionCallExamples,
  tryCatchExamples,
  simpleLiteralExamples,
  operatorExamples
}
