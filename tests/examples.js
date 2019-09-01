const _ = require('lodash');

const func = () => ({
  type: 'Function',
  async: false,
  arguments: null,
  statements: []
});

const assignment = (symbol, value) => ({
  type: 'Assignment', symbol, value
});

const def = (symbol) => ({ type: "Def", symbol });

const map = (...properties) => ({ type: "MapLiteral", properties });

const property = (key, value) => ({ type: "Property", key, value });

const reference = (symbol) => ({ type: "Reference", symbol });

const string = (value) => ({ type: 'StringLiteral', value });

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
    'a = () => {\n\n}'
  ],
  [
    'Comment after assignment',
    'a = () => {} // ignored',
    assignment('a', func()),
    'a = () => {\n\n}',
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
    map(property('a', reference('null'))),
    '{ a: null }'
  ],
  [
    'a = #{ a: null b: "foo" }',
    assignment('a', map(
      property('a', reference('null')),
      property('b', string('foo'))
    )),
    'a = { a: null, b: "foo" }'
  ],
  [
    'Map within a map',
    'a = #{ a: #{ b: "foo" } c: d }',
    assignment('a', map(
      property('a', map(property('b', string('foo')))),
      property('c', reference('d'))
    )),
    'a = { a: { b: "foo" }, c: d }',
  ]
);

const miscExamples = makeExamples(
  [
    'def a',
    def('a'),
    'let a'
  ]
);


module.exports = {
  functionDeclarationExamples,
  assignmentExamples,
  mapExamples,
  miscExamples
}
