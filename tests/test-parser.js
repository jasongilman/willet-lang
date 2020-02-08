const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const parser = require('../parser');
const { dsl } = require('../lib/ast-helper');

const fullExampleCode = fs.readFileSync(`${__dirname}/examples/full_parser_example.wlt`);

const expected = dsl.program(
  dsl.literal('//before1'),
  dsl.literal('before2/* */'),
  dsl.literal('after'),
  dsl.stringInterpolation(
    dsl.literal('string '),
    dsl.literal(true),
    dsl.literal(' interpolation\ncan be multiplelines.\nCan have '),
    dsl.stringInterpolation(
      dsl.literal('Another interpolation '),
      dsl.plus(dsl.literal(5), dsl.literal(7)),
      dsl.literal('.')
    ),
    dsl.literal('\n')
  ),
  dsl.literal(1),
  dsl.literal(2.3),
  dsl.literal('4'),
  dsl.boolean(true),
  dsl.boolean(false),
  dsl.map(),
  dsl.array(),
  dsl.set(),
  dsl.list(),
  dsl.map(
    dsl.property(
      'foo',
      dsl.array(
        dsl.set(
          dsl.list(
            dsl.literal('bar')
          )
        )
      )
    ),
    dsl.property('chew', dsl.map())
  ),
  dsl.and(
    // Left and
    dsl.plus(
      dsl.multiply(
        dsl.number(1),
        dsl.number(2)
      ),
      dsl.minus(
        dsl.number(3),
        // right minus
        dsl.divide(
          dsl.number(4),
          dsl.modulus(
            dsl.number(5),
            dsl.number(6)
          )
        ),
      )
    ),
    dsl.negate(
      dsl.list(
        dsl.or(
          dsl.number(7),
          dsl.number(8)
        )
      )
    )
  ),
  dsl.valueSeq(
    dsl.reference('foo'),
    dsl.getProperty('bar'),
    dsl.getPropertyDynamic(dsl.number(0)),
    dsl.functionCallWithBody()
  ),
  dsl.valueSeq(
    dsl.reference('foo'),
    dsl.functionCall()
  ),
  dsl.valueSeq(
    dsl.reference('foo'),
    dsl.functionCallWithBody()
  ),
  dsl.valueSeq(
    dsl.reference('foo'),
    dsl.functionCallWithBody([
      dsl.number(1),
      dsl.number(2),
      dsl.spread(dsl.reference('rest'))
    ], dsl.block(
      dsl.reference('bar'),
      dsl.Null,
      dsl.Undefined
    ))
  ),
);

describe('Parsing', () => {
  it('should parse full example', async () => {
    const result = parser.parse(fullExampleCode.toString());
    expect(result.toJS()).to.deep.equal(expected.toJS());
  });
});
