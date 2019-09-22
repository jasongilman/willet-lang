const _ = require('lodash');
const parser = require('./parser');
const macroExpander = require('./lib/macro-expander');
const jsCompiler = require('./lib/javascript-compiler');

// TODO improve errors if using a javascript keyword for an identifier in willet

const createContext = (dirname) => ({
  dirname,
  macroContext: macroExpander.createContext(dirname)
});

const trace = (event) => {
  console.log(JSON.stringify(event, null, 2));
};

const compile = (source, context = createContext()) => {
  let start = Date.now();

  console.log('Starting parsing');
  let ast = parser.parse(source, { cache: true, tracer: { trace } });
  // let ast = parser.parse(source, { cache: true });
  console.log('Parsed time', Date.now() - start);

  start = Date.now();
  ast = macroExpander.expandMacros(ast, context.macroContext);
  console.log('Expand Macro time', Date.now() - start);

  start = Date.now();
  const jsCode = jsCompiler.compile(ast);
  console.log('Compile time', Date.now() - start);

  return jsCode;
};

module.exports = {
  createContext,
  compile
};
