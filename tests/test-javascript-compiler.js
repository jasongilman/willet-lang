// FUTURE Write tests in willet.
const _ = require('lodash');
const chai = require('chai');
const expect = chai.expect;
const compiler = require('../compiler');
const examples = require('./examples');
const beautify = require('js-beautify').js;

const assertSingleStatement = (input, expectedCode) => {
  console.log('==================================================================================');
  const result = compiler.compile(compiler.createContext(), input);
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

// TODO skipping this for now because the compiled javascript includes the core which changes
// what's expected. We need it for the if examples though.
describe.skip('Willet JavaScript Compiler', () => {
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
