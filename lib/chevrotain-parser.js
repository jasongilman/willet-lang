const _ = require('lodash');
const { dsl } = require('./ast-helper');
const lexer = require('./chevrotain-lexer');
const chevrotain = require('chevrotain');
const EmbeddedActionsParser = chevrotain.EmbeddedActionsParser;

const Let = lexer.tokenVocabulary.Let;
const Fn = lexer.tokenVocabulary.Fn;
const StringLiteral = lexer.tokenVocabulary.StringLiteral;
const NumberLiteral = lexer.tokenVocabulary.NumberLiteral;
const Defmacro = lexer.tokenVocabulary.Defmacro;
const Def = lexer.tokenVocabulary.Def;
const Quote = lexer.tokenVocabulary.Quote;
const Unquote = lexer.tokenVocabulary.Unquote;
const True = lexer.tokenVocabulary.True;
const False = lexer.tokenVocabulary.False;
const Null = lexer.tokenVocabulary.Null;
const Symbol = lexer.tokenVocabulary.Symbol;
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
const LessThanOrEqual = lexer.tokenVocabulary.LessThanOrEqual;
const GreaterThanOrEqual = lexer.tokenVocabulary.GreaterThanOrEqual;
const LessThan = lexer.tokenVocabulary.LessThan;
const GreaterThan = lexer.tokenVocabulary.GreaterThan;
const DoubleEqual = lexer.tokenVocabulary.DoubleEqual;
const NotEqual = lexer.tokenVocabulary.NotEqual;
const Equal = lexer.tokenVocabulary.Equal;
const And = lexer.tokenVocabulary.And;
const Or = lexer.tokenVocabulary.Or;
const Not = lexer.tokenVocabulary.Not;
const Semicolon = lexer.tokenVocabulary.Semicolon;
const Comma = lexer.tokenVocabulary.Comma;

// String interpolation related tokens
const BacktickEnter = lexer.tokenVocabulary.BacktickEnter;
const BacktickExit = lexer.tokenVocabulary.BacktickExit;
const LDollarCurly = lexer.tokenVocabulary.LDollarCurly;
const InterpolatedStringChars = lexer.tokenVocabulary.InterpolatedStringChars;

const AMBIGUOUS_LEFT_PAREN_AFTER_FN_ERROR_MSG = `
  Ambiguous left parenthesis: A left parenthesis was found after a function definition which is
 ambiguous. It could be the start of another function call or a parentheses wrapped expression. Use
 a dot .() for chained function calls and semicolons to separate statements with parentheses wrapped
 expressions.`.replace(/\n/g, '').trim();

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

const precedence = {
  '*': 4,
  '/': 4,
  '%': 4,
  '+': 3,
  '-': 3,
  '<': 2,
  '>': 2,
  '<=': 2,
  '>=': 2,
  '==': 2,
  '!=': 2,
  '&&': 1,
  '||': 1
};

const composeInfixes = (left, rest) => {
  const operands = [left];
  const operators = [];

  while (!_.isEmpty(rest)) {
    const { operator, right } = rest.shift();
    if (_.isEmpty(operators)) {
      operators.push(operator);
    }
    else {
      while (!_.isEmpty(operators) && precedence[operator] < precedence[_.last(operators)]) {
        const a = operands.pop();
        const b = operands.pop();
        const op = operators.pop();
        operands.push(dsl.infix(b, op, a));
      }
      operators.push(operator);
    }
    operands.push(right);
  }

  while (!_.isEmpty(operators)) {
    const a = operands.pop();
    const b = operands.pop();
    const op = operators.pop();
    operands.push(dsl.infix(b, op, a));
  }

  return _.first(operands);
};

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

    $.TopLevelStatement = $.RULE('TopLevelStatement', () => {
      const stmt = orRules(
        'def',
        'Macro',
        'Assignment',
        'Expression'
      );
      $.OPTION(() => {
        $.CONSUME(Semicolon);
      });
      return stmt;
    });

    $.BlockStatement = $.RULE('BlockStatement', () => {
      const stmt = orRules(
        'def',
        'Assignment',
        'Expression'
      );
      $.OPTION(() => {
        $.CONSUME(Semicolon);
      });
      return stmt;
    });

    $.Assignment = $.RULE('Assignment', () => {
      $.CONSUME(Let);
      const target = $.SUBRULE1($.AssignmentTarget);
      $.CONSUME(Equal);
      const expression = $.SUBRULE2($.Expression);
      return dsl.assignment(target, expression);
    });

    $.def = $.RULE('def', () => {
      $.CONSUME(Def);
      const target = $.SUBRULE($.AssignmentTarget);
      let expression;
      $.OPTION(() => {
        $.CONSUME(Equal);
        expression = $.SUBRULE($.Expression);
      });
      return dsl.def(target, expression);
    });

    $.Expression = $.RULE('Expression', () => orRules(
      'BinaryExpression'
    ));

    $.BinaryExpression = $.RULE('BinaryExpression', () => {
      const left = $.SUBRULE1($.NonInfixExpression);
      const rest = [];
      $.MANY(() => {
        const operator = orLiteralTokens(
          Plus,
          Minus,
          Multiply,
          Divide,
          Modulus,
          LessThanOrEqual,
          GreaterThanOrEqual,
          LessThan,
          GreaterThan,
          DoubleEqual,
          NotEqual,
          And,
          Or
        );
        const right = $.SUBRULE2($.NonInfixExpression);
        rest.push({ right, operator });
      });
      return $.ACTION(() => composeInfixes(left, rest));
    });

    $.ParenWrappedExpression = $.RULE('ParenWrappedExpression', () => {
      $.CONSUME(LParen);
      const e = $.SUBRULE($.Expression);
      $.CONSUME(RParen);
      return e;
    });

    $.FunctionLiteral = $.RULE('FunctionLiteral', () => {
      $.CONSUME(Fn);
      const args = $.SUBRULE($.ArgumentDecl);
      const body = $.SUBRULE($.Block);
      return dsl.func(args, body);
    });

    $.ArgumentDecl = $.RULE('ArgumentDecl', () => {
      $.CONSUME(LParen);
      const values = [];
      $.MANY(() => {
        values.push($.SUBRULE1($.FunctionArgumentWithDefault));
        $.OPTION1(() => {
          $.CONSUME(Comma);
        });
      });
      $.OPTION2(() => {
        $.CONSUME(Spread);
        values.push(dsl.restAssignment($.SUBRULE2($.FunctionArgumentWithDefault)));
      });
      $.CONSUME(RParen);
      return values;
    });

    $.FunctionArgumentWithDefault = $.RULE('FunctionArgumentWithDefault', () => {
      const arg = $.SUBRULE1($.FunctionArgumentCore);
      let theDefault = null;
      $.OPTION(() => {
        $.CONSUME(Equal);
        theDefault = $.SUBRULE2($.Expression);
      });
      return dsl.funcArg(arg, theDefault);
    });

    $.FunctionArgumentCore = $.RULE('FunctionArgumentCore', () => orRules(
      'SymbolReference',
      'MapLiteral',
      'ArrayLiteral',
    ));

    $.NonInfixExpression = $.RULE('NonInfixExpression', () => orRules(
      'quote',
      'unquote',
      'ValueSequence',
      'SoloBlock',
      'UnaryExpression'
    ));

    $.UnaryExpression = $.RULE('UnaryExpression', () => {
      $.CONSUME(Not);
      const expr = $.SUBRULE($.NonInfixExpression);
      return dsl.not(expr);
    });

    $.Literal = $.RULE('Literal', () => orRules(
      'NullLiteral',
      'BooleanLiteral',
      'numberLiteral',
      'stringLiteral',
      'MapLiteral',
      'ArrayLiteral',
      'FunctionLiteral',
      'StringInterpolation'
    ));

    $.ValueReference = $.RULE('ValueReference', () => orRules(
      'ParenWrappedExpression',
      'Literal',
      'SymbolReference'
    ));

    $.quote = $.RULE('quote', () => {
      $.CONSUME(Quote);
      $.CONSUME(LParen);
      let quoteResult;
      $.OR([
        {
          ALT: () => {
            quoteResult = dsl.quoteWithExpression($.SUBRULE($.Expression));
            $.CONSUME1(RParen);
          }
        },
        {
          ALT: () => {
            $.CONSUME2(RParen);
            quoteResult = dsl.quoteWithBlock($.SUBRULE($.Block));
          }
        }
      ]);
      return quoteResult;
    });

    $.unquote = $.RULE('unquote', () => {
      $.CONSUME(Unquote);
      $.CONSUME(LParen);
      const expression = $.SUBRULE($.Expression);
      $.CONSUME(RParen);
      return dsl.unquote(expression);
    });

    $.Macro = $.RULE('Macro', () => {
      $.CONSUME(Defmacro);
      const symbol = $.SUBRULE($.symbol);
      $.CONSUME(Equal);
      const expression = $.SUBRULE($.Expression);
      return dsl.macro(symbol, expression);
    });

    $.ValueSequence = $.RULE('ValueSequence', () => {
      const items = [$.SUBRULE($.ValueReference)];

      $.MANY(() => {
        items.push(orRules(
          'GetProperty',
          'GetPropertyDynamic',
          'FunctionCall',
        ));
      });
      if (items.length === 1) {
        return items[0];
      }
      return dsl.valueSeq(...items);
    });

    $.ValueSequenceSymbolOnly = $.RULE('ValueSequenceSymbolOnly', () => {
      const items = [$.SUBRULE($.SymbolReference)];

      $.MANY(() => {
        items.push(orRules(
          'GetProperty',
          'GetPropertyDynamic',
          'FunctionCall',
        ));
      });
      if (items.length === 1) {
        return items[0];
      }
      return dsl.valueSeq(...items);
    });

    $.KeywordToken = $.RULE('KeywordToken', () => orLiteralTokens(...lexer.keywordTokens));

    $.GetProperty = $.RULE('GetProperty', () => {
      $.CONSUME(Dot);
      // Can be a symbol OR a keyword token
      const symbol = orRules('KeywordToken', 'symbol');
      return dsl.getProperty(symbol);
    });

    $.GetPropertyDynamic = $.RULE('GetPropertyDynamic', () => {
      $.CONSUME(Dot);
      $.CONSUME(LSquare);
      const e = $.SUBRULE($.Expression);
      $.CONSUME(RSquare);
      return dsl.getPropertyDynamic(e);
    });

    $.FunctionCall = $.RULE('FunctionCall', () =>
      $.OR1([
        {
          ALT: () => {
            const args = [];
            $.OPTION1(() => {
              $.CONSUME1(Dot);
            });
            $.CONSUME1(LParen);
            $.MANY(() => {
              args.push(orRules('spread', 'Expression'));
              $.OPTION2(() => {
                $.CONSUME(Comma);
              });
            });
            $.CONSUME(RParen);
            let block;
            $.OPTION3(() => {
              block = $.SUBRULE1($.Block);
            });

            const nextToken = $.LA(1);
            if (nextToken.tokenType === LParen) {
              this.SAVE_ERROR(new chevrotain.MismatchedTokenException(
                AMBIGUOUS_LEFT_PAREN_AFTER_FN_ERROR_MSG,
                nextToken
              ));
            }

            if (block) {
              return dsl.functionCallWithBody(args, block);
            }
            return dsl.functionCall(...args);
          }
        },
        {
          ALT: () => {
            $.OPTION5(() => {
              $.CONSUME5(Dot);
            });
            const block = $.SUBRULE2($.Block);

            const nextToken = $.LA(1);
            if (nextToken.tokenType === LParen) {
              this.SAVE_ERROR(new chevrotain.MismatchedTokenException(
                AMBIGUOUS_LEFT_PAREN_AFTER_FN_ERROR_MSG,
                nextToken
              ));
            }
            return dsl.functionCallWithBody([], block);
          }
        }
      ]));

    $.Block = $.RULE('Block', () => {
      $.CONSUME(LCurly);
      const stmts = [];
      $.MANY(() => {
        stmts.push($.SUBRULE($.BlockStatement));
      });
      $.CONSUME(RCurly);
      return dsl.block(...stmts);
    });

    $.SoloBlock = $.RULE('SoloBlock', () => {
      $.CONSUME(LCurly);
      const stmts = [];
      $.MANY(() => {
        stmts.push($.SUBRULE($.BlockStatement));
      });
      $.CONSUME(RCurly);
      return dsl.soloBlock(...stmts);
    });

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

    $.StringInterpolation = $.RULE('StringInterpolation', () => {
      $.CONSUME(BacktickEnter);
      const parts = [];
      $.MANY(() => {
        $.OR([
          {
            ALT: () => {
              parts.push($.CONSUME(InterpolatedStringChars).image);
            }
          },
          {
            ALT: () => {
              $.CONSUME(LDollarCurly);
              parts.push($.SUBRULE($.Expression));
              $.CONSUME(RCurly);
            }
          }
        ]);
      });
      $.CONSUME(BacktickExit);
      return dsl.stringInterpolation(...parts);
    });

    $.symbol = $.RULE('symbol', () => $.CONSUME(Symbol).image);

    $.SymbolReference = $.RULE('SymbolReference', () => {
      const s = $.SUBRULE($.symbol);
      return dsl.reference(s);
    });

    $.MapLiteral = $.RULE('MapLiteral', () => {
      $.CONSUME(LPoundCurly);
      const props = [];
      $.MANY(() => {
        $.OR1([
          {
            ALT: () => {
              // TODO handle array for dynamic keys
              const key = orRules('stringLiteral', 'numberLiteral');
              $.CONSUME1(Colon);
              const value = $.SUBRULE1($.Expression);
              props.push(dsl.property(key, value));
              $.OPTION1(() => {
                $.CONSUME1(Comma);
              });
            }
          },
          {
            ALT: () => {
              const key = $.SUBRULE($.symbol);
              let value = dsl.reference(key);
              $.OPTION2(() => {
                $.CONSUME2(Colon);
                value = $.SUBRULE2($.Expression);
              });
              props.push(dsl.property(key, value));
              $.OPTION3(() => {
                $.CONSUME2(Comma);
              });
            }
          }
        ]);
      });
      $.CONSUME(RCurly);
      return dsl.map(...props);
    });

    $.PropertyName = $.RULE('PropertyName', () => orRules(
      'symbol',
      'stringLiteral',
      'numberLiteral'
    ));

    $.ArrayLiteral = $.RULE('ArrayLiteral', () => {
      $.CONSUME(LSquare);
      const values = [];
      $.MANY(() => {
        values.push(orRules(
          'spread',
          'Expression'
        ));
        $.OPTION(() => {
          $.CONSUME(Comma);
        });
      });
      $.CONSUME(RSquare);
      return dsl.array(...values);
    });

    $.spread = $.RULE('spread', () => {
      $.CONSUME(Spread);
      const result = $.SUBRULE($.Expression);
      return dsl.spread(result);
    });

    $.AssignmentTarget = $.RULE('AssignmentTarget', () => orRules(
      'MapLiteral',
      'ArrayLiteral',
      'ValueSequenceSymbolOnly',
    ));

    // very important to call this after all the rules have been defined.
    // otherwise the parser may not work correctly as it will lack information
    // derived during the self analysis phase.
    this.performSelfAnalysis();
  }
}

// We only ever need one as the parser internal state is reset for each new input.
const parserInstance = new WilletParserEmbedded();

const parse = (inputText) => {
  const lexResult = lexer.lex(inputText);
  // ".input" is a setter which will reset the parser's internal's state.
  parserInstance.input = lexResult.tokens;

  // No semantic actions so this won't return anything yet.
  const ast = parserInstance.Program();

  if (parserInstance.errors.length > 0) {
    for (const error of parserInstance.errors) {
      console.log('\n\n');
      console.log('Syntax Error:', error.message);
      if (error.token) {
        console.log('\n');
        console.log(lexer.formatSourceErrorContext(inputText, error.token.startLine,
          error.token.endLine));
        console.log('\n\n');
      }
    }
    const error = new Error('Parse errors detected');
    error.data = {
      errors: parserInstance.errors
    };
    throw error;
  }

  return ast;
};


module.exports = {
  parse
};
