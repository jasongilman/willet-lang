const Immutable = require('immutable');
const { List } = Immutable;
const { dsl } = require('./ast-helper');
const parser = require('./chevrotain-parser');
const semanticParser = require('./semantic-parser');
const macroExpander = require('./macro-expander');
const keywordReplacer = require('./keyword-replacer');
const jsCompiler = require('./javascript-compiler');
const { createContext, inBrowser } = require('./context');
const pirates = require('pirates');

const CORE_START = '/* WILLET_CORE_START */';
const CORE_END = '/* WILLET_CORE_END */';

const addWilletCore = (context, ast) =>
  ast.update('statements', (s) => List([
    dsl.staticJs(CORE_START),
    dsl.staticJs(context.core.coreRequire),
    dsl.staticJs(context.core.coreImport),
    dsl.staticJs(CORE_END),
  ]).concat(s));

const parse = (context, source) => {
  let ast = parser.parse(source);
  ast = keywordReplacer.replaceJsKeywords(ast);
  return semanticParser.parse(ast);
};

const expandAndCompile = (context, ast) => {
  ast = macroExpander.expandMacros(context, ast);

  // Insert willet core
  if (!context.skipCore) {
    ast = addWilletCore(context, ast);
  }

  return jsCompiler.compile(context, ast);
};

const compile = (context, source) =>
  expandAndCompile(context, parse(context, source));

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
  parse,
  expandAndCompile,
  compile
};
