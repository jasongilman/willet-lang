const parser = require('./parser');
const macroExpander = require('./lib/macro-expander');
const keywordReplacer = require('./lib/keyword-replacer');
const jsCompiler = require('./lib/javascript-compiler');

// TODO improve errors if using a javascript keyword for an identifier in willet

const createContext = (dirname = '.') => ({
  dirname,
  skipCore: false
});

const compile = (context, source) => {
  let ast = parser.parse(source);
  ast = keywordReplacer.replaceJsKeywords(ast);
  console.log('-----------------------------------');
  console.log(`ast: ${JSON.stringify(ast, null, 2)}`);
  ast = macroExpander.expandMacros(context, ast);
  const compiled = jsCompiler.compile(ast);

  console.log(compiled);

  return compiled;
};

module.exports = {
  createContext,
  compile
};
