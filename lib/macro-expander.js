const _ = require('lodash');
const astHelper = require('./ast-helper');
const compiler = require('./javascript-compiler');
const parser = require('../parser');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const willetCore = require('../dist/willet-core');

const willetCoreMacros = _.filter(_.keys(willetCore), (k) => {
  const val = willetCore[k];
  return _.isFunction(val) && val._wlt_macro;
});

// TODO hygenic macros

// TODO add main function at top level
const isReference = (node) => node.type === 'Reference';
const isFunctionCall = (node) => node.type === 'FunctionCall';

const isFnCallValueSeq = ({ values }) =>
  values.length >= 2 && isReference(values[0]) && isFunctionCall(values[1]);

const runNodeInContext = (context, node) => {
  const compiledJs = compiler.compile(node);
  vm.runInContext(compiledJs, context.macroContext.vmContext);
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
    context.macroContext.macrosInScope.add(node.symbol);

    // Compile the js into a "let <node.symbol> = <node.fn>" statement and execute in the vm sandbox
    // It will now be available within the vm to execute things
    runNodeInContext(context, node);
    return node;
  },

  ValueSequence: (context, visitor, node) => {
    if (isFnCallValueSeq(node)) {
      const [{ symbol }, { args, block }, ...subsequent] = node.values;
      if (context.macroContext.macrosInScope.has(symbol)) {
        const compiledMacro = vm.runInContext(symbol, context.macroContext.vmContext);
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

let expandMacros;

let willetRequire;

const willetCoreImport = _.map(
  _.keys(willetCore),
  (k) => `const ${k} = willetCore.${k};`
).join('\n');

const createNewVMContext = (dirname) => {
  const context = vm.createContext({
    process,
    module,
    require: willetRequire(dirname),
    __dirname: dirname
  });
  vm.runInContext('process.chdir(__dirname)', context);
  // Load willet core
  const pathToWilletCore = `${__dirname}/../dist/willet-core`;
  vm.runInContext(`const willetCore = require("${pathToWilletCore}");`, context);
  vm.runInContext(willetCoreImport, context);
  return context;
};

willetRequire = (dirname) => (requirePath) => {
  const willetPath = `${requirePath}.wlt`;

  let fullPath;
  try {
    fullPath = require.resolve(willetPath, { paths: [dirname] });
  }
  catch (err) {
    // ignoring path lookup issue. It must be a regular javascript file
    // if it doesn't exist the default require will throw an error
  }
  if (fullPath) {
    const contents = fs.readFileSync(fullPath).toString();
    const newDirname = path.dirname(fullPath);
    const parsed = parser.parse(contents);
    const expanded = expandMacros(parsed);
    const compiledJs = compiler.compile(expanded);
    return vm.runInContext(compiledJs, createNewVMContext(newDirname));
  }
  // Couldn't find a willet file so just use normal javascript require
  // eslint-disable-next-line
  return require(requirePath);
};

const createContext = (dirname = './') => ({
  macroContext: {
    // Top level macros in the current module that are available
    macrosInScope: new Set(willetCoreMacros),
    vmContext: createNewVMContext(dirname)
  }
});

expandMacros = (astRoot, context = createContext()) => {
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
