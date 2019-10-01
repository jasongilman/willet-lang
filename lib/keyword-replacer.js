/* eslint-disable prefer-template */
const _ = require('lodash');
const astHelper = require('./ast-helper');

const jsKeywords = new Set(['break', 'case', 'catch', 'continue', 'debugger', 'default', 'delete',
  'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof', 'new', 'return', 'switch',
  'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'class', 'const', 'enum',
  'export', 'extends', 'import', 'super', 'let', 'package', 'private', 'protected', 'public',
  'static', 'yield', 'NaN', 'Infinity', 'undefined']);

const symbolToJs = (symbol) => {
  if (jsKeywords.has(symbol)) {
    return `${symbol}$wlt`;
  }
  return symbol;
};

const replacers = {
  RestAssignment: (node) => _.update(node, 'symbol', symbolToJs),
  Reference: (node) => _.update(node, 'symbol', symbolToJs),
  GetProperty: (node) => _.update(node, 'attrib', symbolToJs),
  Property: (node) => _.update(node, 'key', symbolToJs),
  Macro: (node) => _.update(node, 'symbol', symbolToJs)
};

const replaceJsKeywords = (astRoot) => {
  const visitor = (context, node) => {
    const replacer = replacers[node.type];
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
