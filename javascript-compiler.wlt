// FUTURE add lodash style functions to core willet library
_ = require('lodash')
parser = require('./dist/willet-parser')

// TODO predeclare vars
def compileNode

compileStatements = (statements) => _(statements)
  .map(compileNode)
  // TODO string concatenation
  .map((s) => s + ";")
  .values()
  .join("\n");


// TODO maps
typeToConverter = #{
  // TODO destructuring
  Program: ({ statements }) => compileStatements(statements),
  // TODO string interpolation
  Assignment: ({ symbol value }) => `${symbol} = ${compileNode(value)}`,
  // FUTURE async and arguments
  Function: ({ async arguments statements}) => `() => {
    ${compileStatements(statements)}
  }`,
  ValueSequence: ({ values }) => _.map(values compileNode).join(""),
  Reference: ({ symbol }) => symbol,
  GetProperty: ({ attrib }) => `.${attrib}`,
  // TODO OR and not
  // TODO strings with single quotes
  FunctionCall: ({ arguments }) => `(${_.map(arguments || [] compileNode).join(', ')})`,
  String: ({ value }) => JSON.stringify(value)
};


compileNode = (node) => (
  // TODO attribute lookup by value
  compiler = typeToConverter[node.type]

  // TODO if
  if(compiler) {
    // TODO try catch
    try {
      // Implicit return
      compiler(node)
    }
    catch(error) {
      error.path.unshift(node.type)
      // TODO throw
      throw(error)
    }
  }
  // TODO new
  error = new(Error(`Unknown node type ${node.type}`))
  error.path = [node.type]
  throw(error)
);

compile = (program) => {
  try {
    // Implicit return
    compileNode(parser.parse(program))
  }
  catch (error) {
    console.log(error)
    console.log('Path: ' error.path)
    throw(error)
  }
}

module.exports = #{
  // TODO maps with key the same as a value
  compile
}

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
