// TODO should get rid of this dependency. (Will do this when rewriting into Willet)
_ = require("lodash")
parser = require("./dist/willet-parser")
esformatter = require("esformatter")

def compileNode

compileStatements = (statements) => _(statements)
  .map(compileNode)
  .map((s) => string(s ";"))
  .values()
  .join("\n")

compileAndJoin = (nodes join) => _.map(nodes compileNode).join(or(join ", "))

compileBlockStatements = (statements) => {
  front = _.slice(statements 0 (statements.length - 1))
  tail = _.last(statements)
  `{${
    compileStatements(front)}
    return ${compileNode(tail)} }`
}

typeToConverter = #{
  Program: (#{ statements }) => compileStatements(statements)

  // The parentheses allow map destructuring to always work
  Assignment: (#{ target value }) => `(${compileNode(target)} = ${compileNode(value)})`

  SymbolAssignment: (#{ symbol }) => symbol
  MapDestructuring: (#{ targets }) => `{${compileAndJoin(targets)}}`
  // FUTURE async and arguments
  Function: (#{ async arguments statements}) => `() => {
    ${compileStatements(statements)}
  }`
  ValueSequence: (#{ values }) => compileAndJoin(values "")
  Reference: (#{ symbol }) => symbol
  GetProperty: (#{ attrib }) => `.${attrib}`
  GetPropertyDynamic: (#{ attrib }) => `[${compileNode(attrib)}]`
  FunctionCall: (#{ arguments }) => `(${compileAndJoin(arguments)})`

  StringLiteral: (#{ value }) => JSON.stringify(value)
  StringInterpolation: (#{ parts }) => string("\`"
    _.map(parts (part) => {
      if (_.isString(part)) {
        part
      }
      else {
        string("${" compileNode(part) "}")
      }
    }).join("")
  "\`")

  MapLiteral: (#{ properties }) => `{ ${compileAndJoin(properties)} }`
  Property: (#{ key value }) => `${key}: ${compileNode(value)}`

  Def: (#{ symbol }) => `let ${symbol}`

  TryCatch: (#{ tryBlock errorSymbol catchBlock finallyBlock }) => `(() => {
      try ${compileBlockStatements(tryBlock)}
      catch(${errorSymbol}) ${compileBlockStatements(catchBlock)}
      ${
        if(finallyBlock) {
          `finally ${compileBlockStatements(finallyBlock)}`
        }
        else { "" }
      }
    })()`

  IfList: (#{ items }) => `(() => {${
      _.map(items compileNode).join("")
    }
      return null;
    })()`

  If: (#{ cond block }) => `if (${compileNode(cond)}) ${
    compileBlockStatements(block)}`

  ElseIf: (#{ cond block }) => `else if (${compileNode(cond)}) ${
    compileBlockStatements(block)}`

  Else: (#{ block }) => `else ${compileBlockStatements(block)}`
}


compileNode = (node) => {
  compiler = typeToConverter[node.type]

  if (compiler) {
    try {
      compiler(node)
    }
    catch(error) {
      error.path.unshift(node.type)
      throw(error)
    }
  }
  error = new(Error(`Unknown node type ${node.type}`))
  // TODO assoc or set
  error.path = [node.type]
  throw(error)
}

compile = (program) => {
  def compiledJs
  try {
    compiledJs = compileNode(parser.parse(program))
  }
  catch (error) {
    console.log(error)
    console.log("Path: " error.path)
    // TODO add this to macros in standard library
    throw(error)
  }
  try {
    esformatter.format(compiledJs)
  }
  catch (error) {
    console.error("Invalid JavaScript generated:" compiledJs)
    throw(error)
  }
}

module.exports = {
  compile
}
