// FUTURE Write tests in willet.
const _ = require('lodash');
const chai = require('chai');
const expect = chai.expect;
const compiler = require('../javascript-compiler');
const examples = require('./examples');
const esformatter = require('esformatter');

const assertSingleStatement = (input, expectedCode) => {
  const result = compiler.compile(input);
  const expected = esformatter.format(expectedCode + ';');
  expect(result).to.deep.equal(expected);
};

describe('Willet JavaScript Compiler', () => {
  for (const [exampleSetName, exampleSet] of _.toPairs(examples)) {
    describe('exampleSetName', () => {
      for (const { name, willet, js } of exampleSet) {
        it(`should compile ${name}`, async () => {
          assertSingleStatement(willet, js);
        });
      }
    });
  }
});
