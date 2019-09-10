const parser = require('./parser');
const macroExpander = require('./lib/macro-expander');
const jsCompiler = require('./lib/javascript-compiler');

const compile = (source, context = macroExpander.createContext()) => {
  // let start = Date.now();

  let ast = parser.parse(source, { cache: true });
  // console.log('Parsed time', Date.now() - start);

  // start = Date.now();
  ast = macroExpander.expandMacros(ast, context);
  // console.log('Expand Macro time', Date.now() - start);

  // start = Date.now();
  const jsCode = jsCompiler.compile(ast);
  // console.log('Compile time', Date.now() - start);

  return jsCode;
};

module.exports = {
  createContext: macroExpander.createContext,
  compile
};
