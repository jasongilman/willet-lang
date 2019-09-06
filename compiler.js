const _ = require('lodash');
const parser = require('./parser');
const macroExpander = require('./lib/macro-expander');
const jsCompiler = require('./lib/javascript-compiler');

const compile = (source) => {
  let ast = parser.parse(source);
  ast = macroExpander.expandMacros(ast);
  return jsCompiler.compile(ast);
};

module.exports = {
  compile
};
//
//
// code = `
// word = "Jason"
//
// defmacro helloer = (name) => quote(
//   if (true) {
//     console.log("hello" unquote(name))
//   }
// )
//
// helloer(word)
// `
//
// code = `
// quote(
//   if (true) {
//     console.log("hello" unquote(name))
//   }
// )
// `;
// code = `quote(
//   console.log("hello")
// )`;
//
// code = 'word = "jason"'
//
// parsed = parser.parse(code)
// console.log(JSON.stringify(parsed, null, 2));
//
// ast = macroExpander.expandMacros(_.cloneDeep(parsed));
//
// _.isEqual(parsed, ast)
//
// console.log(JSON.stringify(ast, null, 2));
//
//
// console.log(jsCompiler.compile(ast));
//
//
// jsCompiler.compile({
//   "type": "MapLiteral",
//   "properties": [
//     {
//       "type": "Property",
//       "key": "type",
//       "value": "StringLiteral"
//     },
//     {
//       "type": "Property",
//       "key": "value",
//       "value": "hello"
//     }
//   ]
// })
//
// s = compile(code)
//
//
// compile('quote("hello")')
