const Immutable = require('immutable');
const { List } = Immutable;
const { dsl } = require('./ast-helper');
const parser = require('./chevrotain-parser');
const semanticParser = require('./semantic-parser');
const macroExpander = require('./macro-expander');
const keywordReplacer = require('./keyword-replacer');
const jsCompiler = require('./javascript-compiler');
const pirates = require('pirates');

// This will also detect when we're running in an environment like an atom plugin.
const inBrowser = typeof window !== 'undefined';

// FUTURE change context to be immutable.
const createContext = (dirname = '.') => ({
  dirname,
  skipCore: false,
  inBrowser,
  useBlockScopedVars: true, // using "var" if false
  useConservativeMacroExecution: false
});

const CORE_START = '/* WILLET_CORE_START */';
const CORE_END = '/* WILLET_CORE_END */';

const addWilletCore = (context, ast) =>
  ast.update('statements', (s) => List([
    dsl.staticJs(CORE_START),
    dsl.staticJs(context.core.coreRequire),
    dsl.staticJs(context.core.coreImport),
    dsl.staticJs(CORE_END),
  ]).concat(s));

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

  // Insert willet core
  if (!context.skipCore) {
    ast = addWilletCore(context, ast);
  }

  const compiled = jsCompiler.compile(ast);
  return compiled;
};

if (!inBrowser) {
  // Not in a browser
  // Hooks into require so that requires for willet code can be automatically compiled
  pirates.addHook(
    (code, _filename) => compile(createContext(), code),
    { exts: ['.wlt'], matcher: () => true }
  );
}

module.exports = {
  createContext,
  compile
};
