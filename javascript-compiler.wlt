// FUTURE add lodash style functions to core willet library
_ = require("lodash")
parser = require("./dist/willet-parser")

def compileNode

compileStatements = (statements) => _(statements)
  .map(compileNode)
  // TODO string common function that joins all strings
  .map((s) => string(s ";"))
  .values()
  .join("\n");


typeToConverter = #{
  Program: (#{ statements }) => compileStatements(statements),
  Assignment: (#{ target value }) => `${compileNode(target)} = ${compileNode(value)}`,
  Function: (#{ async arguments statements}) => `() => {
    ${compileStatements(statements)}
  }`,
  ValueSequence: (#{ values }) => _.map(values compileNode).join(""),
  Reference: (#{ symbol }) => symbol,
  GetProperty: (#{ attrib }) => `.${attrib}`,

  // TODO add "or" and "and" and "not" functions
  FunctionCall: (#{ arguments }) => `(${_.map(or(arguments []) compileNode).join(", ")})`,
  String: (#{ value }) => JSON.stringify(value)
};


compileNode = (node) => (
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
    console.log("Path: " error.path)
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
