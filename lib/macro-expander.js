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

const expanders = {
  // When a statement is complete compile it and add it to the context

  Macro: (context, visitor, node) => {
    console.log('Evaluating macro', node.symbol);
    // TODO test that a macro can reference another macro in it's implementation
    node.fn = astHelper.prewalk(context, visitor, node.fn);

    // TODO may not need this if we can use vm.runInContext(symbol, vmContext)._wlt_macro
    context.macrosInScope.add(node.symbol);

    // Compile the js into a "let <node.symbol> = <node.fn>" statement and execute in the vm sandbox
    // It will now be available within the vm to execute things
    const compiledJs = compiler.compile(node);
    vm.runInContext(compiledJs, context.vmContext);
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

const expandMacros = (astRoot) => {
  const context = {
    // Top level macros in the current module that are available
    macrosInScope: new Set(),
    vmContext: createNewVMContext()
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
  expandMacros
};
