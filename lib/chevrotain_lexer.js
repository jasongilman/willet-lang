const _ = require('lodash');
const chevrotain = require('chevrotain');
const Lexer = chevrotain.Lexer;
const createToken = chevrotain.createToken;

const Identifier = createToken({ name: 'Identifier', pattern: /[a-zA-Z]\w*/ });

const titleCase = (s) => _.startCase(s).replace(/\s+/g, '');

const keywordTokenStrings = [
  'defmacro',
  'def',
  'quote',
  'unquote',
  'if',
  'else',
  'try',
  'catch',
  'true',
  'false',
  'null'
];

const keywordTokens = _.map(keywordTokenStrings, (keyword) => createToken({
  name: titleCase(keyword),
  pattern: new RegExp(_.escapeRegExp(keyword)),
  longer_alt: Identifier
}));

const punctuationTokenNameToStrings = {
  colon: ':',
  lPoundCurly: '#{',
  rCurly: '}',
  lCurly: '{',
  lSquare: '[',
  rSquare: ']',
  spread: '...',
  lParen: '(',
  rParen: ')',
  dot: '.',
  plus: '+',
  multiply: '*',
  minus: '-',
  divide: '/',
  modulus: '%',
  arrow: '=>',
  lessThanOrEqual: '<=',
  greaterThanOrEqual: '>=',
  lessThan: '<',
  greaterThan: '>',
  doubleEqual: '==',
  notEqual: '!=',
  equal: '=',
  backtick: '`'
};

const punctuationTokens = _(punctuationTokenNameToStrings)
  .toPairs()
  .map(([name, chars]) => createToken({
    name: titleCase(name),
    pattern: new RegExp(_.escapeRegExp(chars))
  }))
  .value();

const WhiteSpace = createToken({
  name: 'WhiteSpace',
  pattern: /[ \r\n\t,;]+/,
  group: Lexer.SKIPPED
});

const StringLiteral = createToken({ name: 'StringLiteral', pattern: /"(\\.|[^"\\])*"/ });

const NumberLiteral = createToken({
  name: 'NumberLiteral',
  pattern: /-?\d+(?:\.\d+)?(?:[E|e][+|-]?\d+)?/
});

const allTokens = _.concat(
  [
    WhiteSpace,
    StringLiteral,
    NumberLiteral
  ],
  keywordTokens,
  [Identifier],
  punctuationTokens
);

const WilletLexer = new Lexer(allTokens);

const tokenVocabulary = _(allTokens)
  .map((token) => [token.name, token])
  .fromPairs()
  .value();

const lex = (inputText) => {
  const lexingResult = WilletLexer.tokenize(inputText);
  if (lexingResult.errors.length > 0) {
    throw Error('Sad Sad Panda, lexing errors detected');
  }
  return lexingResult;
};

module.exports = {
  tokenVocabulary,
  lex
};

// eslint-disable-next-line no-unused-vars
const generateImports = () => {
  const lines = _.map(allTokens, (token) =>
    `const ${token.name} = lexer.tokenVocabulary.${token.name};`);
  console.log(lines.join('\n'));
};

// generateImports()
