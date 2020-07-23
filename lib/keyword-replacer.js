/* eslint-disable prefer-template */
const astHelper = require('./ast-helper');

// Excluding operators
// typeof, new, instanceof, throw
// Excluding 'NaN', 'Infinity', 'undefined'

const jsKeywords = new Set(['break', 'case', 'catch', 'continue', 'debugger', 'default', 'delete',
  'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'return', 'switch',
  'this', 'try', 'var', 'void', 'while', 'with', 'class', 'const', 'enum',
  'export', 'extends', 'import', 'super', 'let', 'package', 'private', 'protected', 'public',
  'static', 'yield']);

const symbolToJs = (symbol) => {
  if (jsKeywords.has(symbol)) {
    return `${symbol}$wlt`;
  }
  return symbol;
};


const replacers = {
  RestAssignment: (node) => node.update('symbol', symbolToJs),
  Reference: (node) => node.update('symbol', symbolToJs),
  Property: (node) => node.update('key', symbolToJs),
  Macro: (node) => node.update('symbol', symbolToJs)
};

const replaceJsKeywords = (astRoot) => {
  const visitor = (context, node) => {
    const replacer = replacers[astHelper.nodeType(node)];
    if (replacer) {
      node = replacer(node);
    }
    return node;
  };

  try {
    return astHelper.prewalk({}, visitor, astRoot);
  }
  catch (error) {
    console.log(error);
    console.log('Path: ', error.path);
    throw error;
  }
};

module.exports = {
  replaceJsKeywords
};
