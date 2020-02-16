const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const parser = require('../lib/chevrotain-parser');
const semanticParser = require('../lib/semantic-parser');
const keywordReplacer = require('../lib/keyword-replacer');
const { dsl } = require('../lib/ast-helper');

const fullExampleCode = fs.readFileSync(`${__dirname}/examples/full_semantic_parser_example.wlt`);

const block = (...statements) => dsl.nonSoloBlock(dsl.block(...statements));

const expected = dsl.program(
  dsl.def(
    'const',
    dsl.reference('logger'),
    dsl.func(
      [dsl.funcArg(dsl.spread(dsl.reference('parts')))],
      block(
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
      block(
        dsl.valueSeq(
          dsl.reference('logger'),
          dsl.functionCall(dsl.reference('alpha'), dsl.reference('beta'))
        ),
        dsl.ifList(
          dsl.ifNode(dsl.greaterThan(dsl.reference('cappa'), dsl.number(45)), block(
            dsl.reference('alpha')
          )),
          dsl.elseIfNode(dsl.lessThan(dsl.reference('cappa'), dsl.number(45)), block(
            dsl.reference('beta')
          )),
          dsl.elseNode(block(dsl.reference('cappa')))
        )
      ),
      true
    ),
    dsl.annotationMap(dsl.property('docs', dsl.string('Some kind of documentation')))
  ),
  dsl.def(
    'const',
    dsl.reference('singleResponseFn'),
    dsl.func([dsl.funcArg(dsl.reference('v'))], block(dsl.reference('v')))
  ),
  dsl.macro(
    'myMacro',
    dsl.func(
      [dsl.funcArg(dsl.reference('blok')), dsl.funcArg(dsl.reference('argv'))],
      block(dsl.array(dsl.reference('blok'), dsl.reference('argv')))
    )
  ),
  dsl.def(
    'let',
    dsl.mapDestructuring(
      dsl.property('foo', dsl.reference('bar')),
      dsl.property('alpha', dsl.reference('alpha'))
    ),
    dsl.Null
  ),
  dsl.def(
    'let',
    dsl.arrayDestructuring(
      dsl.reference('a'),
      dsl.reference('b'),
      dsl.spread(dsl.reference('c'))
    ),
    dsl.Null
  ),
  dsl.def(
    'let',
    dsl.reference('myFun'),
    dsl.func(
      [
        dsl.funcArg(dsl.mapDestructuring(
          dsl.property('a', dsl.reference('a')),
          dsl.property('b', dsl.reference('b'))
        )),
        dsl.funcArg(dsl.arrayDestructuring(
          dsl.reference('c'),
          dsl.reference('d')
        ))
      ],
      block(dsl.Null)
    ),
  ),
  dsl.quote(dsl.string('with args')),
  dsl.quote(block(dsl.string('with block'))),
  dsl.unquote(dsl.string('with args')),
  dsl.unquote(block(dsl.string('with block'))),
  dsl.tryCatch(
    block(dsl.valueSeq(dsl.reference('foo'), dsl.functionCall())),
    dsl.reference('err'),
    block(dsl.valueSeq(
      dsl.reference('logger'),
      dsl.functionCall(dsl.reference('err'))
    )),
    block(dsl.valueSeq(dsl.reference('bar'), dsl.functionCall())),
  ),
  dsl.reference('middle'),
  dsl.tryCatch(
    block(dsl.valueSeq(dsl.reference('foo'), dsl.functionCall())),
    dsl.reference('err'),
    block(dsl.valueSeq(
      dsl.reference('logger'),
      dsl.functionCall(dsl.reference('err'))
    ))
  ),
  dsl.reference('after')
);

describe('Semantic Parsing', () => {
  it('should parse full example', async () => {
    let ast = parser.parse(fullExampleCode.toString());
    ast = keywordReplacer.replaceJsKeywords(ast);
    const result = semanticParser.parse(ast);
    expect(result.toJS()).to.deep.equal(expected.toJS());
  });
});
