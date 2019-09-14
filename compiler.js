const parser = require('./parser');
const macroExpander = require('./lib/macro-expander');
const jsCompiler = require('./lib/javascript-compiler');

// TODO improve errors if using a javascript keyword for an identifier in willet

const createContext = (dirname) => ({
  dirname,
  macroContext: macroExpander.createContext(dirname)
});

const compile = (source, context = createContext()) => {
  // let start = Date.now();

  let ast = parser.parse(source, { cache: true });
  // console.log('Parsed time', Date.now() - start);

  // start = Date.now();
  ast = macroExpander.expandMacros(ast, context.macroContext);
  // console.log('Expand Macro time', Date.now() - start);

  // start = Date.now();
  const jsCode = jsCompiler.compile(ast);
  // console.log('Compile time', Date.now() - start);

  return jsCode;
};

module.exports = {
  createContext,
  compile
};
//
// code = `
// def _ = require("lodash")
// def #{ dsl } = require("./ast-helper")
//
// def chunk = _.chunk
// def last = _.last
// def slice = _.slice
// def drop = _.drop
// def map = _.map
// def isEmpty = _.isEmpty
//
// // TODO make it so that def can be run multiple times in a row without getting the "identifer has
// // already been declared error"
//
// def processPairs = (block [pair ...rest]) => {
//   def [ref collection] = pair
//   if (isEmpty(rest)) {
//     def fn = dsl.func(
//       [dsl.symbolAssignment(ref.symbol)],
//       block
//     )
//     quote(map(unquote(collection), unquote(fn)))
//   }
// }
//
// defmacro furl = (...args) => {
//   def block = last(args)
//   def pairs = chunk(drop(args), 2)
//   processPairs(block, pairs)
// }`;
//
// context = macroExpander.createContext()
// parsed = parser.parse(code)
// expanded = macroExpander.expandMacros(parsed, context)
//
// code2 = `furl( i [ 1 2 3]) {
//   i
// }`
//
// parsed = parser.parse(code2)
// expanded = macroExpander.expandMacros(parsed, context)
//
// console.log(JSON.stringify(expanded, null, 2));
//
// jsCompiler.compile(expanded)
