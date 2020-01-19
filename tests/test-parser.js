// FUTURE Write tests in willet.
const _ = require('lodash');
const chai = require('chai');
const expect = chai.expect;
const parser = require('../parser');
const examples = require('./examples');

const assertSingleStatement = (input, expectedStmts) => {
  if (!_.isArray(expectedStmts)) {
    expectedStmts = [expectedStmts];
  }
  const result = parser.parse(input);
  const expected = { type: 'Program', statements: expectedStmts };
  expect(result).to.deep.equal(expected);
};

describe('Willet Parser', () => {
  for (const [exampleSetName, exampleSet] of _.toPairs(examples)) {
    describe(exampleSetName, () => {
      for (const { name, willet, ast } of exampleSet) {
        it(`should parse ${name}`, async () => {
          assertSingleStatement(willet, ast);
        });
      }
    });
  }
});
