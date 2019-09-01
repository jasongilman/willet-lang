// FUTURE Write tests in willet.
const _ = require('lodash');
const chai = require('chai');
const expect = chai.expect;
const parser = require('../dist/willet-parser');
const examples = require('./examples');

const assertSingleStatement = (input, expectedStmt) => {
  const result = parser.parse(input);
  const expected = { type: 'Program', statements: [expectedStmt] };
  expect(result).to.deep.equal(expected);
};

describe('Willet Parser', () => {
  for (const [exampleSetName, exampleSet] of _.toPairs(examples)) {
    describe('exampleSetName', () => {
      for (const { name, willet, ast } of exampleSet) {
        it(`should parse ${name}`, async () => {
          assertSingleStatement(willet, ast);
        });
      }
    });
  }
});
