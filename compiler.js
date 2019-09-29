const parser = require('./parser');
const macroExpander = require('./lib/macro-expander');
const jsCompiler = require('./lib/javascript-compiler');

// TODO improve errors if using a javascript keyword for an identifier in willet

const createContext = (dirname = '.') => ({
  dirname,
  skipCore: false
});

const compile = (context, source) => {
  let ast = parser.parse(source);
  ast = macroExpander.expandMacros(context, ast);
  return jsCompiler.compile(ast);
};

module.exports = {
  createContext,
  compile
};
