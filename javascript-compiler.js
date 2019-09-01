// TODO should get rid of this dependency. (Will do this when rewriting into Willet)
const _ = require('lodash');
const parser = require('./dist/willet-parser');

let compileNode;

const compileStatements = (statements) => _(statements)
  .map(compileNode)
  .map((s) => s + ';')
  .values()
  .join('\n');


const typeToConverter = {
  Program: ({ statements }) => compileStatements(statements),
  Assignment: ({ symbol, value }) => `${symbol} = ${compileNode(value)}`,
  // TODO async and arguments
  Function: ({ async, arguments, statements}) => `() => {
    ${compileStatements(statements)}
  }`,
  ValueSequence: ({ values }) => _.map(values, compileNode).join(''),
  Reference: ({ symbol }) => symbol,
  GetProperty: ({ attrib }) => `.${attrib}`,
  FunctionCall: ({ arguments }) => `(${_.map(arguments || [], compileNode).join(', ')})`,
  String: ({ value }) => JSON.stringify(value)
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
  try {
    return compileNode(parser.parse(program));
  }
  catch (error) {
    console.log(error);
    console.log('Path: ', error.path);
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
