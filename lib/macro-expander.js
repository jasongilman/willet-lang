const _ = require('lodash');
const astHelper = require('./ast-helper');
const compiler = require('./javascript-compiler');

const isFnCallValueSeq = ({ values }) =>
  values.length >= 2 && values[0].type === 'Reference' && values[1].type === 'FunctionCall';

const createNewScope = () => ({});

const visitStatements = (context, visitor, statements) => {
  if (_.isNil(statements)) {
    return null;
  }
  context.scopeStack.unshift(createNewScope());
  try {
    return _.map(statements, (s) => astHelper.prewalk(context, visitor, s));
  }
  finally {
    context.scopeStack.shift();
  }
};

const findSymbolInScopes = (context, symbol) => {
  const scope = _.find(context.scopeStack, (s) => s[symbol]);
  return scope ? scope[symbol] : null;
};

// TODO how do we allow macros to be defined and then referenced later when using invokes?

const expanders = {
  Macro: (context, visitor, { symbol, fn }) => {
    // TODO test that a macro can reference another macro in it's implementation
    const expandedFunction = astHelper.prewalk(context, visitor, fn);
    const compiledJs = compiler.compile(expandedFunction);

    // TODO research if there are safe ways of doing eval
    // eslint-disable-next-line no-eval
    const compiledFunction = eval(compiledJs);
    context.scopeStack[0][symbol] = compiledFunction;
    return { type: 'Null' };
  },

  // Scopes
  Function: (context, visitor, node) => {
    node.statements = visitStatements(context, visitor, node.statements);
    return node;
  },

  TryCatch: (context, visitor, node) => {
    node.tryBlock = visitStatements(context, visitor, node.tryBlock);
    node.catchBlock = visitStatements(context, visitor, node.catchBlock);
    node.finallyBlock = visitStatements(context, visitor, node.finallyBlock);
    return node;
  },

  If: (context, visitor, node) => {
    node.cond = astHelper.prewalk(context, visitor, node.cond);
    node.block = visitStatements(context, visitor, node.block);
    return node;
  },

  ElseIf: (context, visitor, node) => {
    node.cond = astHelper.prewalk(context, visitor, node.cond);
    node.block = visitStatements(context, visitor, node.block);
    return node;
  },

  Else: (context, visitor, node) => {
    node.block = visitStatements(context, visitor, node.block);
    return node;
  },

  ValueSequence: (context, visitor, node) => {
    if (isFnCallValueSeq(node)) {
      const [{ symbol }, { args, block }, ...subsequent] = node.values;
      const compiledMacro = findSymbolInScopes(context, symbol);
      if (compiledMacro) {
        // Call the macro with the ast
        const macroArgs = _.concat(args, [block]);
        const replacement = compiledMacro(...macroArgs);

        if (_.isEmpty(subsequent)) {
          // The value sequence is only the function call
          node = replacement;
        }
        else {
          // TODO test this
          // There are other subsequent calls after the macro
          node.values = _.concat([replacement], subsequent);
        }
      }
    }
    return node;
  }
};

const expandMacros = (rootRegistry, astRoot) => {
  const context = {
    scopeStack: [rootRegistry]
  };

  const visitor = (context2, node) => {
    const expander = expanders[node.type];
    if (expander) {
      // Return a wrapper that marks the node as being done and no subsequent walking needed
      node = astHelper.doneWalking(expander(context2, visitor, node));
    }
    return node;
  };

  try {
    return astHelper.prewalk(context, visitor, astRoot);
  }
  catch (error) {
    console.log(error);
    console.log('Path: ', error.path);
    throw error;
  }
};

module.exports = {
  expandMacros,
  createNewScope
};
