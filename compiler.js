const parser = require('./lib/chevrotain-parser');
const semanticParser = require('./lib/semantic-parser');
const macroExpander = require('./lib/macro-expander');
const keywordReplacer = require('./lib/keyword-replacer');
const jsCompiler = require('./lib/javascript-compiler');
const pirates = require('pirates');

// FUTURE change context to be immutable.
const createContext = (dirname = '.') => ({
  dirname,
  skipCore: false
});

const compile = (context, source) => {
  let ast = parser.parse(source);
  // console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  // console.log(`ast: ${JSON.stringify(ast, null, 2)}`);
  ast = keywordReplacer.replaceJsKeywords(ast);
  // console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  // console.log(`ast: ${JSON.stringify(ast, null, 2)}`);
  ast = semanticParser.parse(ast);
  // console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  // console.log(`ast: ${JSON.stringify(ast, null, 2)}`);
  ast = macroExpander.expandMacros(context, ast);
  // console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  // console.log(`ast: ${JSON.stringify(ast, null, 2)}`);
  const compiled = jsCompiler.compile(ast);
  return compiled;
};

// Hooks into require so that requires for willet code can be automatically compiled
pirates.addHook(
  (code, _filename) => compile(createContext(), code),
  { exts: ['.wlt'], matcher: () => true }
);

module.exports = {
  createContext,
  compile
};
