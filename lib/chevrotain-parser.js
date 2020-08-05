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
const Typeof = lexer.tokenVocabulary.Typeof;
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

const getPosition = (tokenHolder) => _.pick(tokenHolder, [
  'startOffset', 'endOffset', 'startLine', 'endLine', 'startColumn', 'endColumn'
]);

const getImageAndPosition = (tokenHolder) => ({
  image: tokenHolder.image,
  pos: getPosition(tokenHolder)
});

const mergePositions = (...positions) => {
  const startPos = _.minBy(positions, 'startOffset');
  const endPos = _.maxBy(positions, 'endOffset');
  return {
    startOffset: startPos.startOffset,
    startLine: startPos.startLine,
    startColumn: startPos.startColumn,
    endOffset: endPos.endOffset,
    endLine: endPos.endLine,
    endColumn: endPos.endColumn,
  };
};

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

const escapeLetterToChar = {
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
  0: '\0',
  '\\': '\\',
  '\'': '\'',
  '`': '`',
  '"': '"'
};

const makeHelpers = ($) => {
  const orRulesCreator = (index) => (...subruleNames) => {
    let result = null;
    $[`OR${index}`](_.map(subruleNames, (ruleName) => ({
      ALT: () => {
        result = $[`SUBRULE${index}`]($[ruleName]);
      }
    })));
    return result;
  };

  const orLiteralTokens = (...tokens) => $.OR(_.map(tokens, (token) => ({
    ALT: () => getImageAndPosition($.CONSUME(token))
  })));

  const withChildPositions = (node, children) =>
    $.ACTION(() => {
      try {
        return node.set('pos', mergePositions(..._.map(_.filter(children), (c) => {
          if (c.get) {
            return c.get('pos');
          }
          if (c.pos) {
            return c.pos;
          }
          console.log(`bad child: ${JSON.stringify(c, null, 2)}`);
          throw new Error('No pos found in child');
        })));
      }
      catch (error) {
        console.log('-----------------------------------');
        console.log(`node: ${JSON.stringify(node, null, 2)}`);
        console.log(`children: ${JSON.stringify(children, null, 2)}`);
        throw error;
      }
    });

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
          operands.push(
            withChildPositions(
              dsl.infix(b, op, a),
              [b, a]
            )
          );
        }
        operators.push(operator);
      }
      operands.push(right);
    }

    while (!_.isEmpty(operators)) {
      const a = operands.pop();
      const b = operands.pop();
      const op = operators.pop();
      operands.push(
        withChildPositions(
          dsl.infix(b, op, a),
          [b, a]
        )
      );
    }
    return _.first(operands);
  };

  return {
    composeInfixes,
    withChildPositions,
    orLiteralTokens,
    orRulesCreator
  };
};

const fixInterpolatedString = (str) => {
  const newChars = [];
  let nextEscaped = false;
  for (let i = 0; i < str.length; i += 1) {
    const next = str[i];
    if (nextEscaped) {
      const replacement = escapeLetterToChar[next];
      if (!replacement) {
        throw new Error(`Illegal escape sequence \\${next}`);
      }
      newChars.push(replacement);
      nextEscaped = false;
    }
    else if (next === '\\') {
      nextEscaped = true;
    }
    else {
      newChars.push(next);
    }
  }
  return newChars.join('');
};

class WilletParserEmbedded extends EmbeddedActionsParser {
  constructor() {
    super(lexer.tokenVocabulary);
    const $ = this;
    const {
      orRulesCreator, orLiteralTokens, withChildPositions, composeInfixes
    } = makeHelpers($);
    const orRules = orRulesCreator('');

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
      return withChildPositions(dsl.program(...stmts), stmts);
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
      return withChildPositions(
        dsl.withAnnotation(stmt, annotation),
        [stmt, annotation]
      );
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
      return withChildPositions(
        dsl.def(type.image, target, expression).set('pos', type.pos),
        [type, expression]
      );
    });

    $.defmacro = $.RULE('defmacro', () => {
      const startPos = $.CONSUME(Defmacro);
      const symbol = $.SUBRULE($.symbol);
      $.CONSUME(Equal);
      const expression = $.SUBRULE($.Expression);
      return withChildPositions(dsl.macro(symbol.image, expression),
        [startPos, expression]);
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
        rest.push({ right, operator: operator.image });
      });
      return $.ACTION(() => composeInfixes(left, rest));
    });

    $.ListLiteral = $.RULE('ListLiteral', () => {
      let annotation = null;
      $.OPTION2(() => {
        annotation = $.SUBRULE1($.Annotation);
      });

      const startPos = $.CONSUME(LPoundParen);
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
      const endPos = $.CONSUME(RParen);
      const list = withChildPositions(dsl.list(...values), [startPos, endPos]);
      return withChildPositions(
        dsl.withAnnotation(list, annotation),
        [annotation, list]
      );
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
        Typeof
      );
      const expr = $.SUBRULE($.NonInfixExpression);
      return withChildPositions(
        dsl.unary(op.image, expr),
        [op, expr]
      );
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
      return withChildPositions(dsl.valueSeq(...items), [_.first(items), _.last(items)]);
    });

    // I _think_ this is here because you may want to do a property reference that's the same
    // name as a willet keyword token.
    $.KeywordToken = $.RULE('KeywordToken', () => orLiteralTokens(...lexer.keywordTokens));

    $.GetProperty = $.RULE('GetProperty', () => {
      const startPos = $.CONSUME(Dot);
      // Can be a symbol OR a keyword token
      const symbol = orRules('KeywordToken', 'symbol');
      return withChildPositions(
        dsl.getProperty(symbol),
        [startPos, symbol]
      );
    });

    $.GetPropertyImmutable = $.RULE('GetPropertyImmutable', () => {
      const startPos = $.CONSUME(DotColon);
      // Can be a symbol OR a keyword token
      const symbol = orRules('KeywordToken', 'symbol');
      return withChildPositions(
        dsl.getPropertyImmutable(symbol),
        [startPos, symbol]
      );
    });

    $.GetPropertyDynamic = $.RULE('GetPropertyDynamic', () => {
      const startPos = $.CONSUME(Dot);
      $.CONSUME(LSquare);
      const e = $.SUBRULE($.Expression);
      const endPos = $.CONSUME(RSquare);
      return withChildPositions(dsl.getPropertyDynamic(e), [startPos, endPos]);
    });

    $.FunctionCall = $.RULE('FunctionCall', () =>
      $.OR1([
        {
          ALT: () => {
            const args = [];
            const startPos = $.CONSUME1(LParen);
            $.MANY(() => {
              args.push(orRules('spread', 'Expression'));
              $.OPTION2(() => {
                $.CONSUME(Comma);
              });
            });
            const endParenPos = $.CONSUME(RParen);
            let block;
            $.OPTION3(() => {
              block = $.SUBRULE1($.Block);
            });

            if (block) {
              return withChildPositions(
                dsl.functionCallWithBody(args, block),
                [startPos, block]
              );
            }
            return withChildPositions(dsl.functionCall(...args), [startPos, endParenPos]);
          }
        },
        {
          ALT: () => { // Function call no parens
            const block = $.SUBRULE2($.Block);
            return $.ACTION(() =>
              dsl.functionCallWithBody([], block).set('pos', block.get('pos')));
          }
        }
      ]));

    $.Block = $.RULE('Block', () => {
      const startPos = $.CONSUME(LCurly);
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
      const endPos = $.CONSUME(RCurly);
      return withChildPositions(dsl.block(...stmts), [startPos, endPos]);
    });

    $.NullLiteral = $.RULE('NullLiteral', () => {
      const pos = getPosition($.CONSUME(Null));
      return dsl.Null.set('pos', pos);
    });
    $.UndefinedLiteral = $.RULE('UndefinedLiteral', () => {
      const pos = getPosition($.CONSUME(Undefined));
      return dsl.Undefined.set('pos', pos);
    });
    $.BooleanLiteral = $.RULE('BooleanLiteral', () => {
      const value = orLiteralTokens(True, False);
      return dsl.boolean(value.image === 'true').set('pos', value.pos);
    });

    $.stringLiteral = $.RULE('stringLiteral', () => {
      const stringLit = getImageAndPosition($.CONSUME(StringLiteral));
      const converted = stringLit.image.replace(/\\'/g, '\'');
      // JSON.parse is a cheaty way to unwrap the outer quotes and replace escape sequences
      // with the real characters.
      return $.ACTION(() => dsl.string(JSON.parse(converted)).set('pos', stringLit.pos));
    });

    const ESCAPED_DOUBLE_QUOTE = '%WLT_EDG%';
    const ESCAPED_DOUBLE_QUOTE_REGEX = new RegExp(_.escapeRegExp(ESCAPED_DOUBLE_QUOTE), 'g');

    $.stringLiteralSingle = $.RULE('stringLiteralSingle', () => {
      const stringLit = getImageAndPosition($.CONSUME(StringLiteralSingle));
      let converted = stringLit.image.slice(1, stringLit.length - 1)
        .replace(/\\"/g, ESCAPED_DOUBLE_QUOTE)
        .replace(/"/g, ESCAPED_DOUBLE_QUOTE)
        .replace(/\\'/g, '\'')
        .replace(ESCAPED_DOUBLE_QUOTE_REGEX, '\\"');
      converted = `"${converted}"`;
      return $.ACTION(() => dsl.string(JSON.parse(converted)).set('pos', stringLit.pos));
    });

    $.keywordLiteral = $.RULE('keywordLiteral', () => {
      const string = getImageAndPosition($.CONSUME(KeywordLiteral));
      const stringImage = string.image;
      return dsl.string(stringImage.substring(1, stringImage.length)).set('pos', string.pos);
    });

    $.numberLiteral = $.RULE('numberLiteral', () => {
      // TODO keep fixing
      const numStr = $.CONSUME(NumberLiteral);
      return dsl.number(parseFloat(numStr.image)).set('pos', numStr.pos);
    });

    $.StringInterpolation = $.RULE('StringInterpolation', () => {
      const startPos = $.CONSUME(BacktickEnter);
      const parts = [];
      $.MANY(() => {
        $.OR([
          {
            ALT: () => {
              const interpString = $.CONSUME(InterpolatedStringChars).image;
              parts.push(dsl.string(fixInterpolatedString(interpString)));
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
      const endPos = $.CONSUME(BacktickExit);
      return withChildPositions(
        dsl.stringInterpolation(...parts),
        [startPos, endPos]
      );
    });

    $.symbol = $.RULE('symbol', () => getImageAndPosition($.CONSUME(Symbol)));

    $.SymbolReference = $.RULE('SymbolReference', () => {
      const s = $.SUBRULE($.symbol);
      return dsl.reference(s.image).set('pos', s.pos);
    });

    const mapRuleWithPrefix = (prefix, dslFunc) => () => {
      const startPos = getPosition($.CONSUME(prefix));
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
              let value = dsl.reference(key.image).set('pos', key.pos);
              $.OPTION2(() => {
                $.CONSUME2(Colon);
                value = $.SUBRULE2($.Expression);
              });
              // TODO Position on property should take into account expression
              props.push(dsl.property(key.image, value));
              $.OPTION3(() => {
                $.CONSUME2(Comma);
              });
            }
          }
        ]);
      });
      const endPos = getPosition($.CONSUME(RCurly));
      return dslFunc(...props).set('pos', mergePositions(startPos, endPos));
    };

    $.MapLiteral = $.RULE('MapLiteral', mapRuleWithPrefix(LPoundCurly, dsl.map));

    $.Annotation = $.RULE('Annotation', () => orRules(
      'annotationSymbol',
      'AnnotationMap'
    ));

    $.annotationSymbol = $.RULE('annotationSymbol', () => {
      const symbol = getImageAndPosition($.CONSUME(AnnotationSymbol));
      const symbolImage = symbol.image.replace('@', '');
      return dsl.singleAnnotation(symbolImage).set('pos', symbol.pos);
    });

    $.AnnotationMap = $.RULE('AnnotationMap', mapRuleWithPrefix(LAtCurly, dsl.annotationMap));

    $.SetLiteral = $.RULE('SetLiteral', () => {
      const startPos = $.CONSUME(LPoundSquare);
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
      const endPos = $.CONSUME(RSquare);
      return withChildPositions(
        dsl.set(...values),
        [startPos, endPos]
      );
    });

    $.ArrayLiteral = $.RULE('ArrayLiteral', () => {
      const startPos = $.CONSUME(LSquare);
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
      const endPos = $.CONSUME(RSquare);
      return withChildPositions(
        dsl.array(...values),
        [startPos, endPos]
      );
    });

    $.spread = $.RULE('spread', () => {
      const startPos = $.CONSUME(Spread);
      const result = $.SUBRULE($.Expression);
      return withChildPositions(dsl.spread(result), [startPos, result]);
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
