const _ = require('lodash');
const { dsl } = require('./ast-helper');
const lexer = require('./chevrotain-lexer');
const chevrotain = require('chevrotain');
const EmbeddedActionsParser = chevrotain.EmbeddedActionsParser;

const Const = lexer.tokenVocabulary.Const;
const Let = lexer.tokenVocabulary.Let;
const New = lexer.tokenVocabulary.New;
const Await = lexer.tokenVocabulary.Await;
const Throw = lexer.tokenVocabulary.Throw;
const StringLiteral = lexer.tokenVocabulary.StringLiteral;
const StringLiteralSingle = lexer.tokenVocabulary.StringLiteralSingle;
const NumberLiteral = lexer.tokenVocabulary.NumberLiteral;
const Defmacro = lexer.tokenVocabulary.Defmacro;
const True = lexer.tokenVocabulary.True;
const False = lexer.tokenVocabulary.False;
const Null = lexer.tokenVocabulary.Null;
const Undefined = lexer.tokenVocabulary.Undefined;
const Symbol = lexer.tokenVocabulary.Symbol;
const AnnotationSymbol = lexer.tokenVocabulary.AnnotationSymbol;
const KeywordLiteral = lexer.tokenVocabulary.KeywordLiteral;
const Colon = lexer.tokenVocabulary.Colon;
const LPoundCurly = lexer.tokenVocabulary.LPoundCurly;
const LAtCurly = lexer.tokenVocabulary.LAtCurly;
const RCurly = lexer.tokenVocabulary.RCurly;
const LCurly = lexer.tokenVocabulary.LCurly;
const LPoundSquare = lexer.tokenVocabulary.LPoundSquare;
const LSquare = lexer.tokenVocabulary.LSquare;
const RSquare = lexer.tokenVocabulary.RSquare;
const Spread = lexer.tokenVocabulary.Spread;
const LPoundParen = lexer.tokenVocabulary.LPoundParen;
const LParen = lexer.tokenVocabulary.LParen;
const RParen = lexer.tokenVocabulary.RParen;
const Dot = lexer.tokenVocabulary.Dot;
const DotColon = lexer.tokenVocabulary.DotColon;
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
const Arrow = lexer.tokenVocabulary.Arrow;
const And = lexer.tokenVocabulary.And;
const Or = lexer.tokenVocabulary.Or;
const Not = lexer.tokenVocabulary.Not;
const Comma = lexer.tokenVocabulary.Comma;
const Semicolon = lexer.tokenVocabulary.Semicolon;

// String interpolation related tokens
const BacktickEnter = lexer.tokenVocabulary.BacktickEnter;
const BacktickExit = lexer.tokenVocabulary.BacktickExit;
const LDollarCurly = lexer.tokenVocabulary.LDollarCurly;
const InterpolatedStringChars = lexer.tokenVocabulary.InterpolatedStringChars;

const makeHelpers = ($) => ({
  orRulesCreator: (index) => (...subruleNames) => {
    let result = null;
    $[`OR${index}`](_.map(subruleNames, (ruleName) => ({
      ALT: () => {
        result = $[`SUBRULE${index}`]($[ruleName]);
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
  '||': 1,
  '=>': 1
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
    const { orRulesCreator, orLiteralTokens } = makeHelpers($);
    const orRules = orRulesCreator('');
    // FUTURE if these are needed
    // const orRules1 = orRulesCreator('1');
    // const orRules2 = orRulesCreator('2');
    // const orRules3 = orRulesCreator('3');

    $.Program = $.RULE('Program', () => {
      const stmts = [];
      $.MANY(() => {
        $.OPTION(() => {
          $.CONSUME(Semicolon);
        });
        stmts.push($.SUBRULE($.Statement));
      });
      $.OPTION2(() => {
        $.CONSUME2(Semicolon);
      });
      return dsl.program(...stmts);
    });

    $.Statement = $.RULE('Statement', () => {
      let annotation = null;
      $.OPTION2(() => {
        annotation = $.SUBRULE1($.Annotation);
      });
      const stmt = orRules(
        'def',
        'defmacro',
        'Expression'
      );
      return dsl.withAnnotation(stmt, annotation);
    });

    $.def = $.RULE('def', () => {
      const type = orLiteralTokens(
        Const,
        Let
      );
      const target = $.SUBRULE2($.ValueSequence);
      let expression;
      $.OPTION3(() => {
        $.CONSUME(Equal);
        expression = $.SUBRULE3($.Expression);
      });
      return dsl.def(type, target, expression);
    });

    $.defmacro = $.RULE('defmacro', () => {
      $.CONSUME(Defmacro);
      const symbol = $.SUBRULE($.symbol);
      $.CONSUME(Equal);
      const expression = $.SUBRULE($.Expression);
      return dsl.macro(symbol, expression);
    });

    $.Expression = $.RULE('Expression', () => $.SUBRULE2($.BinaryExpression));

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
          Equal,
          GreaterThan,
          DoubleEqual,
          NotEqual,
          And,
          Or,
          Arrow
        );
        const right = $.SUBRULE2($.NonInfixExpression);
        rest.push({ right, operator });
      });
      return $.ACTION(() => composeInfixes(left, rest));
    });

    $.ListLiteral = $.RULE('ListLiteral', () => {
      let annotation = null;
      $.OPTION2(() => {
        annotation = $.SUBRULE1($.Annotation);
      });

      $.CONSUME(LPoundParen);
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
      $.CONSUME(RParen);
      return dsl.withAnnotation(dsl.list(...values), annotation);
    });

    $.NonInfixExpression = $.RULE('NonInfixExpression', () => orRules(
      'ValueSequence',
      'Block',
      'UnaryExpression'
    ));

    $.UnaryExpression = $.RULE('UnaryExpression', () => {
      const op = orLiteralTokens(
        Not,
        New,
        Await,
        Throw,
      );
      const expr = $.SUBRULE($.NonInfixExpression);
      return dsl.unary(op, expr);
    });

    $.Literal = $.RULE('Literal', () => orRules(
      'NullLiteral',
      'UndefinedLiteral',
      'BooleanLiteral',
      'numberLiteral',
      'keywordLiteral',
      'stringLiteral',
      'stringLiteralSingle',
      'MapLiteral',
      'ArrayLiteral',
      'ListLiteral',
      'SetLiteral',
      'StringInterpolation'
    ));

    $.ValueReference = $.RULE('ValueReference', () => orRules(
      'Literal',
      'SymbolReference'
    ));

    $.ValueSequence = $.RULE('ValueSequence', () => {
      const items = [$.SUBRULE($.ValueReference)];

      $.MANY(() => {
        items.push(orRules(
          'GetPropertyImmutable',
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

    // I _think_ this is here because you may want to do a property reference that's the same
    // name as a willet keyword token.
    $.KeywordToken = $.RULE('KeywordToken', () => orLiteralTokens(...lexer.keywordTokens));

    $.GetProperty = $.RULE('GetProperty', () => {
      $.CONSUME(Dot);
      // Can be a symbol OR a keyword token
      const symbol = orRules('KeywordToken', 'symbol');
      return dsl.getProperty(symbol);
    });

    $.GetPropertyImmutable = $.RULE('GetPropertyImmutable', () => {
      $.CONSUME(DotColon);
      // Can be a symbol OR a keyword token
      const symbol = orRules('KeywordToken', 'symbol');
      return dsl.getPropertyImmutable(symbol);
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

            if (block) {
              return dsl.functionCallWithBody(args, block);
            }
            return dsl.functionCall(...args);
          }
        },
        {
          ALT: () => { // Function call no parens
            const block = $.SUBRULE2($.Block);
            return dsl.functionCallWithBody([], block);
          }
        }
      ]));

    $.Block = $.RULE('Block', () => {
      $.CONSUME(LCurly);
      const stmts = [];
      $.MANY(() => {
        $.OPTION(() => {
          $.CONSUME(Semicolon);
        });
        stmts.push($.SUBRULE($.Statement));
      });
      $.OPTION2(() => {
        $.CONSUME2(Semicolon);
      });
      $.CONSUME(RCurly);
      return dsl.block(...stmts);
    });

    $.NullLiteral = $.RULE('NullLiteral', () => {
      $.CONSUME(Null);
      return dsl.Null;
    });
    $.UndefinedLiteral = $.RULE('UndefinedLiteral', () => {
      $.CONSUME(Undefined);
      return dsl.Undefined;
    });
    $.BooleanLiteral = $.RULE('BooleanLiteral', () => {
      const value = orLiteralTokens(True, False);
      return dsl.boolean(value === 'true');
    });

    $.stringLiteral = $.RULE('stringLiteral', () => {
      const stringLit = $.CONSUME(StringLiteral).image;
      const converted = stringLit.replace(/\\'/g, '\'');
      // JSON.parse is a cheaty way to unwrap the outer quotes and replace escape sequences
      // with the real characters.
      return $.ACTION(() => dsl.string(JSON.parse(converted)));
    });

    const ESCAPED_DOUBLE_QUOTE = '%WLT_EDG%';
    const ESCAPED_DOUBLE_QUOTE_REGEX = new RegExp(_.escapeRegExp(ESCAPED_DOUBLE_QUOTE), 'g');

    $.stringLiteralSingle = $.RULE('stringLiteralSingle', () => {
      const stringLit = $.CONSUME(StringLiteralSingle).image;
      let converted = stringLit.slice(1, stringLit.length - 1)
        .replace(/\\"/g, ESCAPED_DOUBLE_QUOTE)
        .replace(/"/g, ESCAPED_DOUBLE_QUOTE)
        .replace(/\\'/g, '\'')
        .replace(ESCAPED_DOUBLE_QUOTE_REGEX, '\\"');
      converted = `"${converted}"`;
      return $.ACTION(() => dsl.string(JSON.parse(converted)));
    });

    $.keywordLiteral = $.RULE('keywordLiteral', () => {
      const string = $.CONSUME(KeywordLiteral).image;
      return dsl.string(string.substring(1, string.length));
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
              parts.push(dsl.string($.CONSUME(InterpolatedStringChars).image));
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

    const mapRuleWithPrefix = (prefix, dslFunc) => () => {
      $.CONSUME(prefix);
      const props = [];
      $.MANY(() => {
        $.OR1([
          {
            ALT: () => {
              // FUTURE handle dynamic keys { [keyRef]: value }
              const key = orRules('stringLiteral', 'stringLiteralSingle', 'numberLiteral');
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
      return dslFunc(...props);
    };

    $.MapLiteral = $.RULE('MapLiteral', mapRuleWithPrefix(LPoundCurly, dsl.map));

    $.Annotation = $.RULE('Annotation', () => orRules(
      'annotationSymbol',
      'AnnotationMap'
    ));

    $.annotationSymbol = $.RULE('annotationSymbol', () => {
      const symbol = $.CONSUME(AnnotationSymbol).image.replace('@', '');
      return dsl.singleAnnotation(symbol);
    });

    $.AnnotationMap = $.RULE('AnnotationMap', mapRuleWithPrefix(LAtCurly, dsl.annotationMap));

    $.SetLiteral = $.RULE('SetLiteral', () => {
      $.CONSUME(LPoundSquare);
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
      return dsl.set(...values);
    });

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

  let formattedErrors;
  if (parserInstance.errors.length > 0) {
    formattedErrors = _.map(parserInstance.errors, (error) => {
      let formattedError = `Syntax Error: ${error.message}`;
      if (error.token) {
        const token = Number.isNaN(error.token.startLine) ? error.previousToken : error.token;
        formattedError = `${formattedError}\n${
          lexer.formatSourceErrorContext(inputText, token.startLine, token.endLine)
        }`;
      }
      console.log(formattedError);
      console.log('\n\n');
      return formattedError;
    });
    const error = new Error('Parse errors detected');
    error.data = {
      errors: formattedErrors
    };
    throw error;
  }

  return ast;
};


module.exports = {
  parse,
  parserInstance
};
