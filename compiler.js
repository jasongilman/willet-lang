const parser = require('./parser');
const macroExpander = require('./lib/macro-expander');
const keywordReplacer = require('./lib/keyword-replacer');
const jsCompiler = require('./lib/javascript-compiler');

// TODO change context to be immutable.
const createContext = (dirname = '.') => ({
  dirname,
  skipCore: false
});

const compile = (context, source) => {
  let ast = parser.parse(source);
  // console.log('-----------------------------------');
  // console.log(`ast: ${JSON.stringify(ast, null, 2)}`);
  ast = keywordReplacer.replaceJsKeywords(ast);
  // console.log('-----------------------------------');
  // console.log(`ast: ${JSON.stringify(ast, null, 2)}`);
  ast = macroExpander.expandMacros(context, ast);
  // console.log('-----------------------------------');
  // console.log(`ast: ${JSON.stringify(ast, null, 2)}`);
  const compiled = jsCompiler.compile(ast);
  return compiled;
};

module.exports = {
  createContext,
  compile
};
