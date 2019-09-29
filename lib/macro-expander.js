const _ = require('lodash');
const astHelper = require('./ast-helper');
const jsCompiler = require('./javascript-compiler');
const parser = require('../parser');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { dsl } = require('./ast-helper');

// TODO Try compile after running clean
const willetCore = require('../dist/willet-core');

const willetCoreMacros = _.filter(_.keys(willetCore), (k) => {
  const val = willetCore[k];
  return _.isFunction(val) && val._wlt_macro;
});

// TODO hygenic macros

// TODO add main function at top level

// TODO add these helpers to dsl
const isReference = (node) => node.type === 'Reference';
const isFunctionCall = (node) => node.type === 'FunctionCall';

const isFnCallValueSeq = ({ values }) =>
  values.length >= 2 && isReference(values[0]) && isFunctionCall(values[1]);

const runNodeInContext = (context, node) => {
  const compiledJs = jsCompiler.compile(node);
  vm.runInContext(compiledJs, context.macroState.vmContext);
};

const expanders = {
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
    context.macroState.macrosInScope.add(node.symbol);

    // Compile the js into a "let <node.symbol> = <node.fn>" statement and execute in the vm sandbox
    // It will now be available within the vm to execute things
    runNodeInContext(context, node);
    return node;
  },

  ValueSequence: (context, visitor, node) => {
    if (isFnCallValueSeq(node)) {
      const [{ symbol }, { args, block }, ...subsequent] = node.values;
      if (context.macroState.macrosInScope.has(symbol)) {
        const compiledMacro = vm.runInContext(symbol, context.macroState.vmContext);
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


const pathToWilletCore = `${__dirname}/../dist/willet-core`;

const willetCoreRequire = `const willetCore = require("${pathToWilletCore}");`;

const willetCoreImport = _.map(
  _.keys(willetCore),
  (k) => `const ${k} = willetCore.${k};`
).join('\n');

const loadWilletCore = (context, vmContext = context.macroState.vmContext) => {
  if (!context.skipCore) {
    // Load willet core
    vm.runInContext(willetCoreRequire, vmContext);
    vm.runInContext(willetCoreImport, vmContext);
  }
};

let initializeMacroState;
let expandMacros;

const createRequireFn = (context) => (requirePath) => {
  const willetPath = `${requirePath}.wlt`;
  let fullPath;
  try {
    fullPath = require.resolve(willetPath, { paths: [context.dirname] });
  }
  catch (err) {
    // ignoring path lookup issue. It must be a regular javascript file
    // if it doesn't exist the default require will throw an error
  }
  if (fullPath) {
    const contents = fs.readFileSync(fullPath).toString();
    const newDirname = path.dirname(fullPath);
    const parsed = parser.parse(contents);
    const newContext = { dirname: newDirname };
    initializeMacroState(newContext, parsed);
    const expanded = expandMacros(newContext, parsed);
    const compiledJs = jsCompiler.compile(expanded);
    return vm.runInContext(compiledJs, context.macroState.vmContext);
  }
  // Couldn't find a willet file so just use normal javascript require
  // eslint-disable-next-line
  return require(requirePath);
};

const createNewVMContext = (requireFn, dirname) => {
  const vmContext = vm.createContext({
    process,
    module,
    require: requireFn,
    __dirname: dirname
  });
  vm.runInContext('process.chdir(__dirname)', vmContext);
  return vmContext;
};

initializeMacroState = (context) => {
  let macrosInScope = new Set();

  if (!context.skipCore) {
    macrosInScope = new Set(willetCoreMacros);
  }

  context.macroState = {
    // Top level macros in the current module that are available
    macrosInScope,
    vmContext: createNewVMContext(createRequireFn(context), context.dirname)
  };
  loadWilletCore(context);
};

expandMacros = (context, astRoot) => {
  initializeMacroState(context);
  const visitor = (context2, node) => {
    const expander = expanders[node.type];
    if (expander) {
      // Return a wrapper that marks the node as being done and no subsequent walking needed
      node = expander(context2, visitor, node);
    }
    return node;
  };

  let result;
  try {
    result = astHelper.postwalk(context, visitor, astRoot);
  }
  catch (error) {
    console.log(error);
    console.log('Path: ', error.path);
    throw error;
  }

  // Insert willet core
  if (!context.skipCore) {
    astRoot.statements.unshift(dsl.staticJs(willetCoreImport));
    // TODO the path required here is wrong (probably)
    astRoot.statements.unshift(dsl.staticJs(willetCoreRequire));
  }

  return result;
};

module.exports = {
  expandMacros,
  // For tests
  willetCoreImport,
  willetCoreRequire
};
