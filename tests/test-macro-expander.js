// FUTURE Write tests in willet.
const _ = require('lodash');
const chai = require('chai');
const expect = chai.expect;
const parser = require('../parser');
const macroExpander = require('../lib/macro-expander');
const beautify = require('js-beautify').js;
const compiler = require('../compiler');
const examples = require('./examples');
const { dsl } = require('../lib/ast-helper');

describe('expand macros when no macros used', () => {
  for (const [exampleSetName, exampleSet] of _.toPairs(examples)) {
    describe(exampleSetName, () => {
      for (const { name, ast } of exampleSet) {
        it(`should expand [${name}] without a change`, async () => {
          const result = macroExpander.expandMacros(
            macroExpander.createNewScope(),
            _.cloneDeep(ast)
          );
          expect(result).to.deep.equal(ast);
        });
      }
    });
  }
});


describe('expand a simple macro', () => {
  const code = `
  word = "Jason"

  defmacro helloer = (name) => quote(
    if (true) {
      console.log("hello" unquote(name))
    }
  )

  helloer(word)
  helloer("literal")`;


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
    ),
    dsl.ifList(
      dsl.ifNode(dsl.boolean(true), [
        dsl.valueSeq(
          dsl.reference('console'),
          dsl.getProperty('log'),
          dsl.functionCall(
            dsl.string('hello'),
            dsl.string('literal')
          )
        )
      ])
    )
  );

  const expectedCode = `
    (word = "Jason");
    null;
    (() => {
        if (true) {
            return console.log("hello", word);
        }
        return null;
    })();
    (() => {
        if (true) {
            return console.log("hello", "literal");
        }
        return null;
    })();
  `;

  it('should expand the macro', async () => {
    const result = macroExpander.expandMacros(macroExpander.createNewScope(), parser.parse(code));
    expect(result).to.deep.equal(expected);
  });

  it('should generate correct javascript', async () => {
    const compiled = compiler.compile(code);
    expect(compiled).to.equal(beautify(expectedCode));
  });

  // TODO add other macro tests
});
