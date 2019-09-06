const parser = require('./parser');
const macroExpander = require('./lib/macro-expander');
const jsCompiler = require('./lib/javascript-compiler');

const compile = (source, macroRegistry = macroExpander.createNewScope()) => {
  let ast = parser.parse(source);
  ast = macroExpander.expandMacros(macroRegistry, ast);
  return jsCompiler.compile(ast);
};

module.exports = {
  createMacroRegistry: macroExpander.createNewScope,
  compile
};
