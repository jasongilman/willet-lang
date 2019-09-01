// FUTURE Write tests in willet.
const _ = require('lodash');
const chai = require('chai');
const expect = chai.expect;
const parser = require('../dist/willet-parser');

const assertSingleStatement = (input, expectedStmt) => {
  const result = parser.parse(input);
  const expected = { type: 'Program', statements: [expectedStmt] };
  expect(result).to.deep.equal(expected);
};

const assertExamples = (examples) => {
  for (const example of examples) {
    const name = example[0];
    const expectedStmt = _.last(example);
    const code = example.length === 2 ? example[0] : example[1];
    it(`should parse ${name}`, async () => {
      assertSingleStatement(code, expectedStmt);
    });
  }
};

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

const functionDeclarationExamples = [
  [
    '() => {}',
    func()
  ]
];

const assignmentExamples = [
  [
    'a = () => {}',
    assignment('a', func())
  ],
  [
    'Comment after assignment',
    'a = () => {} // ignored',
    assignment('a', func())
  ]
];

const miscExamples = [
  [
    'def a',
    def('a')
  ]
];

describe('Willet Parser', () => {
  describe('misc', () => {
    assertExamples(miscExamples);
  });
  describe('function declarations', () => {
    assertExamples(functionDeclarationExamples);
  });
  describe('assignment', () => {
    assertExamples(assignmentExamples);
  });
});
