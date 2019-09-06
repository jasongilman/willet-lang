// FUTURE Write tests in willet.
const _ = require('lodash');
const chai = require('chai');
const expect = chai.expect;
const parser = require('../parser');
const macroExpander = require('../lib/macro-expander');
const examples = require('./examples');
const { dsl } = require('../lib/ast-helper');

describe('expand macros when no macros used', () => {
  for (const [exampleSetName, exampleSet] of _.toPairs(examples)) {
    describe(exampleSetName, () => {
      for (const { name, ast } of exampleSet) {
        it(`should expand [${name}] without a change`, async () => {
          const result = macroExpander.expandMacros(_.cloneDeep(ast));
          expect(result).to.deep.equal(ast);
        });
      }
    });
  }
});


describe('expand a simple macro', () => {
  const ast = parser.parse(`
  word = "Jason"

  defmacro helloer = (name) => quote(
    if (true) {
      console.log("hello" unquote(name))
    }
  )

  helloer(word)`);

  const expected = dsl.program(
    dsl.assignment(dsl.symbolAssignment('word'), dsl.string('Jason')),
    dsl.Null,
    dsl.ifList(
      dsl.ifNode(dsl.boolean(true), [
        dsl.valueSeq(
          dsl.reference('console'),
          dsl.getProperty('log'),
          dsl.functionCall(
            dsl.string('hello'),
            dsl.reference('word')
          )
        )
      ])
    )
  );

  it('should expand the macro', async () => {
    const result = macroExpander.expandMacros(ast);
    expect(result).to.deep.equal(expected);
  });

  // TODO add other macro tests
});
