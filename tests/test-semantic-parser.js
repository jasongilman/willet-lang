const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const parser = require('../parser');
const semanticParser = require('../lib/semantic-parser');
const { dsl } = require('../lib/ast-helper');

const fullExampleCode = fs.readFileSync(`${__dirname}/examples/full_semantic_parser_example.wlt`);

const expected = dsl.program(
  dsl.def(
    'const',
    dsl.reference('logger'),
    dsl.func(
      [dsl.funcArg(dsl.spread(dsl.reference('parts')))],
      dsl.block(
        dsl.valueSeq(
          dsl.reference('console'),
          dsl.getProperty('log'),
          dsl.functionCall(dsl.reference('parts'))
        )
      )
    )
  ),
  dsl.def(
    'const',
    dsl.reference('multilineFunction'),
    dsl.func(
      [
        dsl.funcArg(dsl.reference('alpha')),
        dsl.funcArg(dsl.reference('beta')),
        dsl.funcArg(dsl.reference('cappa'), dsl.plus(dsl.number(45), dsl.number(7)))
      ],
      dsl.block(
        dsl.valueSeq(
          dsl.reference('logger'),
          dsl.functionCall(dsl.reference('alpha'), dsl.reference('beta'))
        ),
        // dsl.valueSeq(
        //   dsl.reference('console'),
        //   dsl.getProperty('log'),
        //   dsl.functionCall(dsl.reference('parts'))
        // )
      )
    ),
    dsl.annotationMap(dsl.property('docs', dsl.string('Some kind of documentation')))
  )
);

describe('Semantic Parsing', () => {
  it('should parse full example', async () => {
    const ast = parser.parse(fullExampleCode.toString());
    const result = semanticParser.parse(ast);
    console.log('-----------------------------------');
    console.log(`result: ${JSON.stringify(result, null, 2)}`);
    expect(result.toJS()).to.deep.equal(expected.toJS());
  });
});
