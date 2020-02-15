const parser = require('./parser');
const yaml = require('js-yaml');
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
  // console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  // console.log(`ast: ${JSON.stringify(ast, null, 2)}`);
  ast = keywordReplacer.replaceJsKeywords(ast);
  // console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  // console.log(`ast: ${JSON.stringify(ast, null, 2)}`);
  ast = macroExpander.expandMacros(context, ast);
  // console.log('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  // console.log(`ast: ${JSON.stringify(ast, null, 2)}`);
  const compiled = jsCompiler.compile(ast);
  return compiled;
};

module.exports = {
  createContext,
  compile
};

const fs = require('fs');
code = fs.readFileSync('wlt-tests/test-parser.wlt').toString()
ast = parser.parse(code)
console.log(JSON.stringify(ast, null, 2));

js = JSON.parse(JSON.stringify(ast))

fs.writeFileSync('dist-tests/test-parser.yaml', yaml.safeDump(js))

// TODO parsing problem here.
ast.getIn(['statements', 4, 'value', 'left', 'values'])
    //
    // value:
    //   type: InfixExpression
    //   operator: =>
    //   left:
    //     type: ListLiteral
    //     values:
    //       - - type: Reference
    //           symbol: input
    //         - type: Reference
    //           symbol: expectedStmts
    //     js: false
