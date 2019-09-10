const _ = require('lodash');
const astHelper = require('./ast-helper');
const compiler = require('./javascript-compiler');
const vm = require('vm');

// TODO add main function at top level
const isReference = (node) => node.type === 'Reference';
const isFunctionCall = (node) => node.type === 'FunctionCall';

const isFnCallValueSeq = ({ values }) =>
  values.length >= 2 && isReference(values[0]) && isFunctionCall(values[1]);

const createNewVMContext = () => vm.createContext({ require });

const runNodeInContext = (context, node) => {
  const compiledJs = compiler.compile(node);
  // TODO remove this debugging when no longer needed
  console.log('-----------------------------------');
  console.log('compiledJs:', compiledJs);
  vm.runInContext(compiledJs, context.vmContext);
};

// TODO Make it work with things required from another file.

const expanders = {
  // When a statement is complete compile it and add it to the context

  Def: (context, visitor, node) => {
    if (context.depth === 1) {
      runNodeInContext(context, node);
    }
    return node;
  },

  Assignment: (context, visitor, node) => {
    if (context.depth === 1) {
      runNodeInContext(context, node);
    }
    return node;
  },

  Expression: (context, visitor, node) => {
    if (context.depth === 1) {
      runNodeInContext(context, node);
    }
    return node;
  },

  Macro: (context, visitor, node) => {
    // TODO test that a macro can reference another macro in it's implementation
    context.macrosInScope.add(node.symbol);

    // Compile the js into a "let <node.symbol> = <node.fn>" statement and execute in the vm sandbox
    // It will now be available within the vm to execute things
    runNodeInContext(context, node);
    return node;
  },

  ValueSequence: (context, visitor, node) => {
    if (isFnCallValueSeq(node)) {
      const [{ symbol }, { args, block }, ...subsequent] = node.values;
      if (context.macrosInScope.has(symbol)) {
        const compiledMacro = vm.runInContext(symbol, context.vmContext);
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

const createContext = () => ({
  // Top level macros in the current module that are available
  macrosInScope: new Set(),
  vmContext: createNewVMContext()
});

const expandMacros = (astRoot, context = createContext()) => {
  const visitor = (context2, node) => {
    const expander = expanders[node.type];
    if (expander) {
      // Return a wrapper that marks the node as being done and no subsequent walking needed
      node = expander(context2, visitor, node);
    }
    return node;
  };

  try {
    return astHelper.postwalk(context, visitor, astRoot);
  }
  catch (error) {
    console.log(error);
    console.log('Path: ', error.path);
    throw error;
  }
};

module.exports = {
  createContext,
  expandMacros
};
