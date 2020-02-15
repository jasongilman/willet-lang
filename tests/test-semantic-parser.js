const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const parser = require('../parser');
const semanticParser = require('../lib/semantic-parser');
const keywordReplacer = require('../lib/keyword-replacer');
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
        dsl.ifList(
          dsl.ifNode(dsl.greaterThan(dsl.reference('cappa'), dsl.number(45)), dsl.block(
            dsl.reference('alpha')
          )),
          dsl.elseIfNode(dsl.lessThan(dsl.reference('cappa'), dsl.number(45)), dsl.block(
            dsl.reference('beta')
          )),
          dsl.elseNode(dsl.block(dsl.reference('cappa')))
        )
      )
    ),
    dsl.annotationMap(dsl.property('docs', dsl.string('Some kind of documentation')))
  ),
  dsl.def(
    'const',
    dsl.reference('singleResponseFn'),
    dsl.func([dsl.funcArg(dsl.reference('v'))], dsl.block(dsl.reference('v')))
  ),
  dsl.def(
    'defmacro',
    dsl.reference('myMacro'),
    dsl.func(
      [dsl.funcArg(dsl.reference('blok')), dsl.funcArg(dsl.reference('argv'))],
      dsl.block(dsl.array(dsl.reference('blok'), dsl.reference('argv')))
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
      dsl.block(dsl.Null)
    ),
  ),
  dsl.quote(dsl.string('with args')),
  dsl.quote(dsl.block(dsl.string('with block'))),
  dsl.unquote(dsl.string('with args')),
  dsl.unquote(dsl.block(dsl.string('with block'))),
  dsl.tryCatch(
    dsl.block(dsl.valueSeq(dsl.reference('foo'), dsl.functionCall())),
    dsl.reference('err'),
    dsl.block(dsl.valueSeq(
      dsl.reference('logger'),
      dsl.functionCall(dsl.reference('err'))
    )),
    dsl.block(dsl.valueSeq(dsl.reference('bar'), dsl.functionCall())),
  ),
  dsl.reference('middle'),
  dsl.tryCatch(
    dsl.block(dsl.valueSeq(dsl.reference('foo'), dsl.functionCall())),
    dsl.reference('err'),
    dsl.block(dsl.valueSeq(
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
    console.log('-----------------------------------');
    console.log(`result: ${JSON.stringify(result, null, 2)}`);
    expect(result.toJS()).to.deep.equal(expected.toJS());
  });
});
