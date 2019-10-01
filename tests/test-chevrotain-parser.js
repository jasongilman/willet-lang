/* eslint-disable no-template-curly-in-string */
const parser = require('../lib/chevrotain-parser');

const examples = [
  'foo (1)',
  'foo {1}',
  '[{1} {2}]'
  // 'foo(i #[1])',
  // '1 * (2 + 3)',
  // '"foo bar"',
  // 'true',
  // 'false',
  // '1',
  // '1.34',
  // '#{ foo: 5 }',
  // 'foo',
  // '[]',
  // '[1 2]',
  // '[...a]',
  // '``',
  // '`$`',
  // '`hello${b}after`',
  // '1 < "5" + 8',
  // 'fn (a, b) a + b',
  // 'let a = 5',
  // 'let [a b] = 5',
  // 'let #{a b} = 5',
  // 'def a = 5',
  // `
  // if (a == true) {
  //   foo
  // }
  // `,
  // 'foo.bar.[5](foo)'
];


describe('Parse all examples', () => {
  for (const example of examples) {
    it(`should parse ${example}`, async () => {
      const result = parser.parse(example);
      console.log('-----------------------------------');
      console.log(example, JSON.stringify(result, null, 2));
    });
  }
});
