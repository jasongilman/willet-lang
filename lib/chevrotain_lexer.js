const _ = require('lodash');
const chevrotain = require('chevrotain');
const Lexer = chevrotain.Lexer;
const createToken = chevrotain.createToken;

const Symbol = createToken({ name: 'Symbol', pattern: /[a-zA-Z]\w*/ });

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
  'null',
  'let'
];

const keywordTokens = _.map(keywordTokenStrings, (keyword) => createToken({
  name: titleCase(keyword),
  pattern: new RegExp(_.escapeRegExp(keyword)),
  longer_alt: Symbol
}));

const punctuationTokenNameToStrings = {
  colon: ':',
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
  equal: '='
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

const BacktickEnter = createToken({
  name: 'BacktickEnter',
  pattern: /`/,
  push_mode: 'string_interpolation_mode'
});

const RCurly = createToken({
  name: 'RCurly',
  pattern: /\}/,
  pop_mode: true
});

const LCurly = createToken({
  name: 'LCurly',
  pattern: /\{/,
  push_mode: 'block_mode'
});

const LPoundCurly = createToken({
  name: 'LPoundCurly',
  pattern: /#\{/,
  push_mode: 'block_mode'
});

const blockModeTokens = _.concat(
  [
    WhiteSpace,
    StringLiteral,
    NumberLiteral,
    LPoundCurly,
    LCurly
  ],
  keywordTokens,
  [Symbol],
  punctuationTokens,
  [
    RCurly,
    BacktickEnter
  ]
);

const LDollarCurly = createToken({
  name: 'LDollarCurly',
  pattern: /\$\{/,
  push_mode: 'block_mode'
});

const BacktickExit = createToken({
  name: 'BacktickExit',
  pattern: /`/,
  pop_mode: true
});

const backtickCharCode = '`'.charCodeAt(0);
const dollarCharCode = '$'.charCodeAt(0);
const lCurlyCharCode = '{'.charCodeAt(0);
const escapeCharCode = '\\'.charCodeAt(0);

// TODO add a test for this that tests the various options

const findInterpolatedStringChars = (text, offset) => {
  let charCode = text.charCodeAt(offset);
  if (charCode === backtickCharCode) {
    return null;
  }

  if (charCode === dollarCharCode && text.charCodeAt(offset + 1) === lCurlyCharCode) {
    return null;
  }

  const start = offset;
  while (
    offset < text.length && (
      // If it's not one of the special characters
      (charCode !== backtickCharCode && charCode !== dollarCharCode) ||
      // It's an escaped backtick
      (charCode === backtickCharCode && text.charCodeAt(offset - 1) === escapeCharCode) ||
      // an escaped $
      (charCode === dollarCharCode && text.charCodeAt(offset - 1) === escapeCharCode) ||
      // A $ not followed by a {
      (charCode === dollarCharCode && text.charCodeAt(offset + 1) !== lCurlyCharCode)
    )
  ) {
    offset += 1;
    charCode = text.charCodeAt(offset);
  }
  return [text.substring(start, offset)];
};

const InterpolatedStringChars = createToken({
  name: 'InterpolatedStringChars',
  pattern: findInterpolatedStringChars,
  line_breaks: true
});

const stringInterpolationModeTokens = [
  InterpolatedStringChars,
  LDollarCurly, // Enters expression mode
  BacktickExit // Exit string interpolation mode
];

const multiModeLexerDefinition = {
  modes: {
    string_interpolation_mode: stringInterpolationModeTokens,
    block_mode: blockModeTokens
  },
  defaultMode: 'block_mode'
};

const WilletLexer = new Lexer(multiModeLexerDefinition);

const allTokens = _.concat(blockModeTokens, stringInterpolationModeTokens);

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
