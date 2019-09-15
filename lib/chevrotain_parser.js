const _ = require('lodash');
const { dsl } = require('./ast-helper');
const lexer = require('./chevrotain_lexer');
const EmbeddedActionsParser = require('chevrotain').EmbeddedActionsParser;

const WhiteSpace = lexer.tokenVocabulary.WhiteSpace;
const StringLiteral = lexer.tokenVocabulary.StringLiteral;
const NumberLiteral = lexer.tokenVocabulary.NumberLiteral;
const Defmacro = lexer.tokenVocabulary.Defmacro;
const Def = lexer.tokenVocabulary.Def;
const Quote = lexer.tokenVocabulary.Quote;
const Unquote = lexer.tokenVocabulary.Unquote;
const If = lexer.tokenVocabulary.If;
const Else = lexer.tokenVocabulary.Else;
const Try = lexer.tokenVocabulary.Try;
const Catch = lexer.tokenVocabulary.Catch;
const True = lexer.tokenVocabulary.True;
const False = lexer.tokenVocabulary.False;
const Null = lexer.tokenVocabulary.Null;
const Identifier = lexer.tokenVocabulary.Identifier;
const Colon = lexer.tokenVocabulary.Colon;
const LPoundCurly = lexer.tokenVocabulary.LPoundCurly;
const RCurly = lexer.tokenVocabulary.RCurly;
const LCurly = lexer.tokenVocabulary.LCurly;
const LSquare = lexer.tokenVocabulary.LSquare;
const RSquare = lexer.tokenVocabulary.RSquare;
const Spread = lexer.tokenVocabulary.Spread;
const LParen = lexer.tokenVocabulary.LParen;
const RParen = lexer.tokenVocabulary.RParen;
const Dot = lexer.tokenVocabulary.Dot;
const Plus = lexer.tokenVocabulary.Plus;
const Multiply = lexer.tokenVocabulary.Multiply;
const Minus = lexer.tokenVocabulary.Minus;
const Divide = lexer.tokenVocabulary.Divide;
const Modulus = lexer.tokenVocabulary.Modulus;
const Arrow = lexer.tokenVocabulary.Arrow;
const LessThanOrEqual = lexer.tokenVocabulary.LessThanOrEqual;
const GreaterThanOrEqual = lexer.tokenVocabulary.GreaterThanOrEqual;
const LessThan = lexer.tokenVocabulary.LessThan;
const GreaterThan = lexer.tokenVocabulary.GreaterThan;
const DoubleEqual = lexer.tokenVocabulary.DoubleEqual;
const NotEqual = lexer.tokenVocabulary.NotEqual;
const Equal = lexer.tokenVocabulary.Equal;
const Backtick = lexer.tokenVocabulary.Backtick;

const makeHelpers = ($) => ({
  orRules: (...subruleNames) => {
    let result = null;
    $.OR(_.map(subruleNames, (ruleName) => ({
      ALT: () => {
        result = $.SUBRULE($[ruleName]);
      }
    })));
    return result;
  },
  orLiteralTokens: (...tokens) => $.OR(_.map(tokens, (token) => ({
    ALT: () => $.CONSUME(token)
  }))).image
});

class WilletParserEmbedded extends EmbeddedActionsParser {
  constructor() {
    super(lexer.tokenVocabulary);
    const $ = this;
    const { orRules, orLiteralTokens } = makeHelpers($);

    $.Program = $.RULE('Program', () => {
      const stmts = [];
      $.MANY(() => {
        stmts.push($.SUBRULE($.TopLevelStatement));
      });
      return dsl.program(...stmts);
    });

    $.TopLevelStatement = $.RULE('TopLevelStatement', () => orRules(
      // 'Assignment',
      // 'Def',
      // 'Macro',
      'Expression'
    ));
    $.Expression = $.RULE('Expression', () => orRules(
      // TODO support infix expression. Find example
      // 'InfixExpression',
      'NonInfixExpression'
    ));

    $.NonInfixExpression = $.RULE('NonInfixExpression', () => orRules(
      // 'IfList',
      // 'TryCatch',
      // 'Quote',
      // 'Unquote',
      // 'ValueSequence',
      'ValueReference'
      // TODO support paren wrapped NonInfixExpression and InfixExpression
    ));

    $.ValueReference = $.RULE('ValueReference', () => orRules(
      'Literal',
      // 'SymbolReference'
    ));

    $.Literal = $.RULE('Literal', () => orRules(
      'NullLiteral',
      'BooleanLiteral',
      'numberLiteral',
      'stringLiteral'
      // 'MapLiteral',
      // 'ArrayLiteral',
      // 'StringInterpolation',
      // 'FunctionLiteral',
    ));

    $.NullLiteral = $.RULE('NullLiteral', () => {
      $.CONSUME(Null);
      return dsl.Null;
    });
    $.BooleanLiteral = $.RULE('BooleanLiteral', () => {
      const value = orLiteralTokens(True, False);
      return dsl.boolean(value === 'true');
    });

    $.stringLiteral = $.RULE('stringLiteral', () => {
      const stringLit = $.CONSUME(StringLiteral).image;
      return dsl.string(stringLit.substring(1, stringLit.length - 1));
    });

    $.numberLiteral = $.RULE('numberLiteral', () => {
      const numStr = $.CONSUME(NumberLiteral).image;
      return dsl.number(parseFloat(numStr));
    });

    // $.TopLevelStatementList = $.RULE('TopLevelStatementList', () => {
    //
    // });
    // $.TopLevelStatementList = $.RULE('TopLevelStatementList', () => {
    //
    // });
    // $.TopLevelStatementList = $.RULE('TopLevelStatementList', () => {
    //
    // });
    // $.TopLevelStatementList = $.RULE('TopLevelStatementList', () => {
    //
    // });

    // very important to call this after all the rules have been defined.
    // otherwise the parser may not work correctly as it will lack information
    // derived during the self analysis phase.
    this.performSelfAnalysis();
  }
}

// We only ever need one as the parser internal state is reset for each new input.
const parserInstance = new WilletParserEmbedded();

const toAst = (inputText) => {
  const lexResult = lexer.lex(inputText);
  // ".input" is a setter which will reset the parser's internal's state.
  parserInstance.input = lexResult.tokens;

  // No semantic actions so this won't return anything yet.
  const ast = parserInstance.Program();

  if (parserInstance.errors.length > 0) {
    throw Error(
      `Sad sad panda, parsing errors detected!\n${
        parserInstance.errors[0].message}`
    );
  }

  return ast;
};


module.exports = {
  toAst
};


toAst('"foo"')
toAst('true')
toAst('false')
toAst("1")
toAst("1.34")
