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
          const result = macroExpander.expandMacros(_.cloneDeep(ast));
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
    dsl.macro('helloer', dsl.func([dsl.symbolAssignment('name')], [
      dsl.quote(
        dsl.ifList(
          dsl.ifNode(dsl.boolean(true), [
            dsl.valueSeq(
              dsl.reference('console'),
              dsl.getProperty('log'),
              dsl.functionCall(
                dsl.string('hello'),
                dsl.unquote(dsl.reference('name'))
              )
            )
          ])
        )
      )
    ])),
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
    let helloer = (name) => {
        return ({
            type: "IfList",
            items: [({
                type: "If",
                cond: ({
                    type: "BooleanLiteral",
                    value: true
                }),
                block: [({
                    type: "ValueSequence",
                    values: [({
                        type: "Reference",
                        symbol: "console"
                    }), ({
                        type: "GetProperty",
                        attrib: "log"
                    }), ({
                        type: "FunctionCall",
                        args: [({
                            type: "StringLiteral",
                            value: "hello"
                        }), name]
                    })]
                })]
            })]
        });
    };
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
    const result = macroExpander.expandMacros(parser.parse(code));
    expect(result).to.deep.equal(expected);
  });

  it('should generate correct javascript', async () => {
    const compiled = compiler.compile(code);
    expect(compiled).to.equal(beautify(expectedCode));
  });
});

describe('expand a macro referencing other vars', () => {
  const code = `
  word = "Jason"

  def quoter = (value) => quote(
    if (true) {
      console.log("hello" unquote(value))
    }
  )

  defmacro helloer = (name) => quoter(name)

  helloer(word)`;


  const expected = dsl.program(
    dsl.assignment(dsl.symbolAssignment('word'), dsl.string('Jason')),
    dsl.def(dsl.symbolAssignment('quoter'), dsl.func([dsl.symbolAssignment('value')], [
      dsl.quote(
        dsl.ifList(
          dsl.ifNode(dsl.boolean(true), [
            dsl.valueSeq(
              dsl.reference('console'),
              dsl.getProperty('log'),
              dsl.functionCall(
                dsl.string('hello'),
                dsl.unquote(dsl.reference('value'))
              )
            )
          ])
        )
      )
    ])),
    dsl.macro('helloer', dsl.func([dsl.symbolAssignment('name')], [
      dsl.valueSeq(
        dsl.reference('quoter'),
        dsl.functionCall(dsl.reference('name'))
      )
    ])),
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

  const expectedCode = `
    (word = "Jason");
    let quoter = (value) => {
        return ({
            type: "IfList",
            items: [({
                type: "If",
                cond: ({
                    type: "BooleanLiteral",
                    value: true
                }),
                block: [({
                    type: "ValueSequence",
                    values: [({
                        type: "Reference",
                        symbol: "console"
                    }), ({
                        type: "GetProperty",
                        attrib: "log"
                    }), ({
                        type: "FunctionCall",
                        args: [({
                            type: "StringLiteral",
                            value: "hello"
                        }), value]
                    })]
                })]
            })]
        });
    };
    let helloer = (name) => {
        return quoter(name);
    };
    (() => {
        if (true) {
            return console.log("hello", word);
        }
        return null;
    })();
  `;

  it('should expand the macro', async () => {
    const result = macroExpander.expandMacros(parser.parse(code));
    expect(result).to.deep.equal(expected);
  });

  it('should generate correct javascript', async () => {
    const compiled = compiler.compile(code);
    expect(compiled).to.equal(beautify(expectedCode));
  });
});

describe('expand a macro referencing other macro', () => {
  const code = `
  defmacro logger = (value) => quote(
    console.log("Alert:" unquote(value))
  )

  defmacro beforeAndAfter = (block) => quote(){
    logger("before")
    unquote(block)
    logger("after")
  }

  def x = 5
  beforeAndAfter() {
    x = x + 1
  }`;

  const expectedCode = `
    let logger = (value) => {
          return ({
              type: "ValueSequence",
              values: [({
                  type: "Reference",
                  symbol: "console"
              }), ({
                  type: "GetProperty",
                  attrib: "log"
              }), ({
                  type: "FunctionCall",
                  args: [({
                      type: "StringLiteral",
                      value: "Alert:"
                  }), value]
              })]
          });
      };
      let beforeAndAfter = (block) => {
          return [].concat(...[({
              type: "ValueSequence",
              values: [({
                  type: "Reference",
                  symbol: "console"
              }), ({
                  type: "GetProperty",
                  attrib: "log"
              }), ({
                  type: "FunctionCall",
                  args: [({
                      type: "StringLiteral",
                      value: "Alert:"
                  }), ({
                      type: "StringLiteral",
                      value: "before"
                  })]
              })]
          }), block, ({
              type: "ValueSequence",
              values: [({
                  type: "Reference",
                  symbol: "console"
              }), ({
                  type: "GetProperty",
                  attrib: "log"
              }), ({
                  type: "FunctionCall",
                  args: [({
                      type: "StringLiteral",
                      value: "Alert:"
                  }), ({
                      type: "StringLiteral",
                      value: "after"
                  })]
              })]
          })]);
      };
    let x = 5;
    console.log("Alert:", "before");
    (x = (x + 1));
    console.log("Alert:", "after");
  `;

  it('should generate correct javascript', async () => {
    const compiled = compiler.compile(code);
    expect(compiled).to.equal(beautify(expectedCode));
  });
});
