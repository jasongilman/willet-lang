const _ = require('lodash');
const parser = require('./parser');
const macroExpander = require('./lib/macro-expander');
const jsCompiler = require('./lib/javascript-compiler');

// TODO improve errors if using a javascript keyword for an identifier in willet

const createContext = (dirname) => ({
  dirname,
  macroContext: macroExpander.createContext(dirname)
});

// Creates a string that will show a parse error in context
const formatSourceErrorContext = (source, location) => {
  const sourceLines = source.split('\n');
  const errorLineStart = location.start.line;
  const errorLineEnd = location.end.line;
  const startLine = Math.max(0, errorLineStart - 4);
  const endLine = Math.min(sourceLines.length - 1, errorLineEnd + 3);

  return _.map(sourceLines.slice(startLine, endLine), (line, index) => {
    const lineNum = index + startLine + 1;
    // Use a marker to show which line has the error
    const marker = lineNum >= errorLineStart && lineNum <= errorLineEnd ? '>' : ' ';

    return `${marker} ${lineNum.toString().padStart(4)}: ${line}`;
  }).join('\n');
};

const trace = (event) => {
  console.log(JSON.stringify(event, null, 2));
};

const compile = (source, context = createContext()) => {
  try {
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
  }
  catch (err) {
    if (err.name === 'SyntaxError') {
      console.log('\n\n');
      console.log('Syntax Error', err.message);
      if (err.location) {
        console.log('\n');
        console.log(formatSourceErrorContext(source, err.location));
        console.log('\n\n');
      }
    }
    throw err;
  }
};

module.exports = {
  createContext,
  compile
};
