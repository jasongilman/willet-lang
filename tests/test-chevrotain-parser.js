/* eslint-disable no-template-curly-in-string */
const chai = require('chai');
const expect = chai.expect;
const parser = require('../lib/chevrotain_parser');

const examples = [
  '"foo bar"',
  'true',
  'false',
  '1',
  '1.34',
  '#{ foo: 5 }',
  'foo',
  '[]',
  '[1 2]',
  '[...a]',
  '``',
  '`$`',
  '`hello${b}after`',
];


describe('Parse all examples', () => {
  for (const example of examples) {
    it(`should parse ${example}`, async () => {
      const result = parser.toAst(example);
      console.log('-----------------------------------');
      console.log(example, JSON.stringify(result, null, 2));
    });
  }
});
