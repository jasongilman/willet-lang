const _ = require('lodash');
const { dsl } = require('./ast-helper');
const lexer = require('./chevrotain_lexer');
const EmbeddedActionsParser = require('chevrotain').EmbeddedActionsParser;

const WhiteSpace = lexer.tokenVocabulary.WhiteSpace;
const Let = lexer.tokenVocabulary.Let;
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
const Arrow = lexer.tokenVocabulary.Arrow;
const LessThanOrEqual = lexer.tokenVocabulary.LessThanOrEqual;
const GreaterThanOrEqual = lexer.tokenVocabulary.GreaterThanOrEqual;
const LessThan = lexer.tokenVocabulary.LessThan;
const GreaterThan = lexer.tokenVocabulary.GreaterThan;
const DoubleEqual = lexer.tokenVocabulary.DoubleEqual;
const NotEqual = lexer.tokenVocabulary.NotEqual;
const Equal = lexer.tokenVocabulary.Equal;

// String interpolation related tokens
const BacktickEnter = lexer.tokenVocabulary.BacktickEnter;
const BacktickExit = lexer.tokenVocabulary.BacktickExit;
const LDollarCurly = lexer.tokenVocabulary.LDollarCurly;
const InterpolatedStringChars = lexer.tokenVocabulary.InterpolatedStringChars;

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
  '*': 3,
  '/': 3,
  '%': 3,
  '+': 2,
  '-': 2,
  '<': 1,
  '>': 1,
  '<=': 1,
  '>=': 1,
  '==': 1,
  '!=': 1
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

    $.TopLevelStatement = $.RULE('TopLevelStatement', () => orRules(
      'Assignment',
      'def',
      // 'Macro',
      'Expression'
    ));

    $.BlockStatement = $.RULE('BlockStatement', () => orRules(
      'Assignment',
      'def',
      'Expression'
    ));

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

    // TODO simplify this
    $.Expression = $.RULE('Expression', () => orRules(
      'BinaryExpression',
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
          NotEqual
        );
        const right = $.SUBRULE2($.NonInfixExpression);
        rest.push({ right, operator });
      });
      return $.ACTION(() => composeInfixes(left, rest));
    });

    $.NonInfixExpression = $.RULE('NonInfixExpression', () => orRules(
      'IfList',
      // 'TryCatch',
      // 'Quote',
      // 'Unquote',
      // 'ValueSequence',

      // Literals
      'NullLiteral',
      'BooleanLiteral',
      'numberLiteral',
      'stringLiteral',
      'MapLiteral',
      'ArrayLiteral',
      'StringInterpolation',
      'FunctionLiteral',

      'SymbolReference'

      // TODO support paren wrapped NonInfixExpression and InfixExpression
    ));

    $.IfList = $.RULE('IfList', () => {
      const items = [$.SUBRULE($.IfNode)];
      $.MANY(() => {
        items.push($.SUBRULE($.ElseIfNode));
      });
      $.OPTION(() => {
        items.push($.SUBRULE($.ElseNode));
      });
      return dsl.ifList(...items);
    });

    $.IfNode = $.RULE('IfNode', () => {
      $.CONSUME(If);
      $.CONSUME(LParen);
      const expression = $.SUBRULE($.Expression);
      $.CONSUME(RParen);
      const block = $.SUBRULE($.Block);
      return dsl.ifNode(expression, block);
    });

    $.ElseIfNode = $.RULE('ElseIfNode', () => {
      $.CONSUME(Else);
      $.CONSUME(If);
      $.CONSUME(LParen);
      const expression = $.SUBRULE($.Expression);
      $.CONSUME(RParen);
      const block = $.SUBRULE($.Block);
      return dsl.elseIfNode(expression, block);
    });

    $.ElseNode = $.RULE('ElseNode', () => {
      $.CONSUME(Else);
      const block = $.SUBRULE($.Block);
      return dsl.elseNode(block);
    });

    $.Block = $.RULE('Block', () => {
      $.CONSUME(LCurly);
      const stmts = [];
      $.MANY(() => {
        stmts.push($.SUBRULE($.BlockStatement));
      });
      $.CONSUME(RCurly);
      return stmts;
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
        const key = $.SUBRULE($.PropertyName);
        $.CONSUME(Colon);
        const value = $.SUBRULE($.Expression);
        props.push(dsl.property(key, value));
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
      });
      $.CONSUME(RSquare);
      return dsl.array(...values);
    });

    $.spread = $.RULE('spread', () => {
      $.CONSUME(Spread);
      const result = orRules(
        'SymbolReference',
        'ArrayLiteral'
      );
      return dsl.spread(result);
    });

    $.FunctionLiteral = $.RULE('FunctionLiteral', () => {
      // TODO async support
      $.CONSUME(LParen);
      const args = [];
      $.MANY(() => {
        args.push(orRules(
          'AssignmentTarget',
          'RestAssignment'
        ));
      });
      $.CONSUME(RParen);
      $.CONSUME(Arrow);
      const body = $.SUBRULE($.FunctionBody);

      return dsl.func(args, body);
    });

    $.FunctionBody = $.RULE('FunctionBody', () => {
      let body = orRules(
        'Expression',
        'Block'
      );

      if (!_.isArray(body)) {
        body = [body];
      }
      return body;
    });

    $.AssignmentTarget = $.RULE('AssignmentTarget', () => {
      let val = orRules(
        'MapDestructuring',
        'ArrayDestructuring',
        // 'ValueSequence',
        'symbol'
      );
      if (_.isString(val)) {
        val = dsl.symbolAssignment(val);
      }
      return val;
    });

    $.MapDestructuring = $.RULE('MapDestructuring', () => {
      $.CONSUME(LPoundCurly);
      const items = [];
      $.MANY(() => {
        items.push(orRules(
          'AssignmentTarget',
          'RestAssignment'
        ));
      });
      $.CONSUME(RCurly);
      return dsl.mapDestructuring(...items);
    });

    $.ArrayDestructuring = $.RULE('ArrayDestructuring', () => {
      $.CONSUME(LSquare);
      const items = [];
      $.MANY(() => {
        items.push(orRules(
          'AssignmentTarget',
          'RestAssignment'
        ));
      });
      $.CONSUME(RSquare);
      return dsl.arrayDestructuring(...items);
    });

    $.RestAssignment = $.RULE('RestAssignment', () => {
      $.CONSUME(Spread);
      const symbol = $.SUBRULE($.symbol);
      return dsl.restAssignment(symbol);
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


// toAst('"foo"')
// toAst('true')
// toAst('false')
// toAst("1")
// toAst("1.34")
// resp = toAst("#{ foo: 5 }")
//
// console.log(JSON.stringify(resp, null, 2));
