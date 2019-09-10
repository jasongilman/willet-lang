// FUTURE Write tests in willet.
const _ = require('lodash');
const chai = require('chai');
const expect = chai.expect;
const parser = require('../parser');
const compiler = require('../lib/javascript-compiler');
const examples = require('./examples');
const beautify = require('js-beautify').js;

const assertSingleStatement = (input, expectedCode) => {
  const result = compiler.compile(parser.parse(input));
  let expected;
  try {
    expected = beautify(`${expectedCode};`);
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
