// TODO should get rid of this dependency. (Will do this when rewriting into Willet)
const _ = require('lodash');
const parser = require('./dist/willet-parser');
const esformatter = require('esformatter');

let compileNode;

const compileStatements = (statements) => _(statements)
  .map(compileNode)
  .map((s) => s + ';')
  .values()
  .join('\n');

const compileAndJoin = (nodes, join = ', ') => _.map(nodes, compileNode).join(join);

const compileBlockStatements = (statements) => {
  const front = _.slice(statements, 0, statements.length - 1);
  const tail = _.last(statements);
  return `{${
    compileStatements(front)}
    return ${compileNode(tail)}; }`
};

const typeToConverter = {
  Program: ({ statements }) => compileStatements(statements),

  // The parentheses allow map destructuring to always work
  Assignment: ({ target, value }) => `(${compileNode(target)} = ${compileNode(value)})`,

  InfixExpression: ({ left, operator, right }) =>
    `(${compileNode(left)} ${operator} ${compileNode(right)})`,

  SymbolAssignment: ({ symbol }) => symbol,
  MapDestructuring: ({ targets }) => `{${compileAndJoin(targets)}}`,
  // TODO async and arguments
  Function: ({ async, arguments, statements}) => `() => {
    ${compileStatements(statements)}
  }`,
  ValueSequence: ({ values }) => compileAndJoin(values, ''),
  Reference: ({ symbol }) => symbol,
  GetProperty: ({ attrib }) => `.${attrib}`,
  GetPropertyDynamic: ({ attrib }) => `[${compileNode(attrib)}]`,
  FunctionCall: ({ arguments }) => `(${compileAndJoin(arguments)})`,

  Null: () => 'null',

  StringLiteral: ({ value }) => JSON.stringify(value),

  NumberLiteral: ({ value }) => JSON.stringify(value),

  StringInterpolation: ({ parts }) => `\`${
    _.map(parts, (part) => {
      if (_.isString(part)) {
        return part;
      }
      return "${" + compileNode(part) + "}";
    }).join('')
  }\``,

  MapLiteral: ({ properties }) => `{ ${compileAndJoin(properties)} }`,
  Property: ({ key, value }) => `${key}: ${compileNode(value)}`,

  Def: ({ symbol }) => `let ${symbol}`,

  TryCatch: ({
    tryBlock,
    errorSymbol,
    catchBlock,
    finallyBlock }) => `(() => {
      try ${compileBlockStatements(tryBlock)}
      catch(${errorSymbol}) ${compileBlockStatements(catchBlock)}
      ${
        finallyBlock ?
        `finally ${compileBlockStatements(finallyBlock)}`
        : ''
      }
    })()`,

  IfList: ({ items }) => `(() => {${
      _.map(items, compileNode).join('')
    }
      return null;
    })()`,

  If: ({ cond, block }) => `if (${compileNode(cond)}) ${
    compileBlockStatements(block)}`,

  ElseIf: ({ cond, block }) => `else if (${compileNode(cond)}) ${
    compileBlockStatements(block)}`,

  Else: ({ block }) => `else ${compileBlockStatements(block)}`

};


compileNode = (node) => {
  const compiler = typeToConverter[node.type];

  if (compiler) {
    try {
      return compiler(node);
    }
    catch(error) {
      error.path.unshift(node.type);
      throw error;
    }
  }
  const error =  new Error(`Unknown node type ${node.type}`);
  error.path = [node.type];
  throw error;
};

const compile = (program) => {
  let compiledJs;
  try {
    compiledJs = compileNode(parser.parse(program));
  }
  catch (error) {
    console.log(error);
    console.log('Path: ', error.path);
    throw error;
  }
  try {
    return esformatter.format(compiledJs);
  }
  catch (error) {
    console.error('Invalid JavaScript generated:', compiledJs);
    throw error;
  }
}

module.exports = {
  compile
};

// exampleCode = `
// a = () => {
//   console.log("hello world!")
// }
//
// a()
// `;
//
// parseTree = parser.parse(exampleCode)
//
// const code = compile(parseTree);
// console.log(code);
//
// eval(code)
