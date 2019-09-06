// FUTURE Write tests in willet.
const _ = require('lodash');
const chai = require('chai');
const expect = chai.expect;
const compiler = require('../compiler');
const examples = require('./examples');
const esformatter = require('esformatter');

const assertSingleStatement = (input, expectedCode) => {
  const result = compiler.compile(input);
  let expected;
  try {
    expected = esformatter.format(`${expectedCode};`);
  }
  catch (error) {
    console.error('Invalid Example JavaScript:', expectedCode);
    throw error;
  }
  expect(result).to.deep.equal(expected);
};

describe('Willet JavaScript Compiler', () => {
  for (const [exampleSetName, exampleSet] of _.toPairs(examples)) {
    describe(exampleSetName, () => {
      for (const { name, willet, js } of exampleSet) {
        if (js) {
          it(`should compile ${name}`, async () => {
            assertSingleStatement(willet, js);
          });
        }
      }
    });
  }
});
