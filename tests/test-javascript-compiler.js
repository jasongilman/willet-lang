// FUTURE Write tests in willet.
const _ = require('lodash');
const chai = require('chai');
const expect = chai.expect;
const compiler = require('../compiler');
const macroExpander = require('../lib/macro-expander');
const examples = require('./examples');
const beautify = require('js-beautify').js;

const removeCore = (code) => {
  code = _.last(code.split(macroExpander.CORE_END));
  code = code.replace(/\n;\n/g, '');
  code = code.replace(/^\s*;/, '');
  code = code.trim();
  return beautify(code);
};

const assertSingleStatement = (input, expectedCode) => {
  console.log('==================================================================================');
  const result = compiler.compile(compiler.createContext(), input);

  // Exclude willet core for comparison
  const withoutCore = removeCore(result);

  let expected;
  try {
    expected = beautify(`${expectedCode};`);
  }
  catch (error) {
    console.error('Invalid Example JavaScript:', expectedCode);
    throw error;
  }
  expect(withoutCore).to.deep.equal(expected);
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
