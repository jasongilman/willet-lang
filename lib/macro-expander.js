const _ = require('lodash');
const Immutable = require('immutable');
const { List } = Immutable;
const astHelper = require('./ast-helper');
const jsCompiler = require('./javascript-compiler');
const vm = require('vm');
const { dsl, isFnCallValueSeq, isFunctionCall } = require('./ast-helper');
const nodeModule = require('module');
const parser = require('./chevrotain-parser');
const semanticParser = require('./semantic-parser');
const keywordReplacer = require('./keyword-replacer');
const fs = require('fs');
const path = require('path');

const vmLoadWilletCore = (context) => {
  if (!context.skipCore) {
    //eslint-disable-next-line
    const willetCore = require('../dist/willet-core');
    const vmContext = context.macroState.vmContext;
    context.core = {};

    if (context.inBrowser) {
      vmContext.Immutable = Immutable;
      vmContext.willetCore = willetCore;
      // eslint-disable-next-line no-undef
      window.Immutable = Immutable;
      // eslint-disable-next-line no-undef
      window.willetCore = willetCore;

      for (const k of _.keys(willetCore)) {
        vmContext[k] = willetCore[k];
      }
    }
    else {
      const coreRequire = `
      const Immutable = require('immutable');
      const willetCore = require('willet/dist/willet-core');`;
      vm.runInContext(coreRequire, vmContext);
      context.core.coreRequire = coreRequire;
    }
    const coreImport = _.map(
      _.keys(willetCore),
      (k) => `const ${k} = willetCore.${k};`
    ).join('\n');
    vm.runInContext(coreImport, vmContext);
    context.core.coreImport = coreImport;
  }
};

// FUTURE hygenic macros

// FUTURE add main function at top level (To prevent side effects. Anything else at the top
// level that's not a var declaration is not allowed)

const getOutputLogs = (context) => {
  const logs = vm.runInContext('getCapturedLogsAndReset()', context.macroState.vmContext);
  if (logs !== '') {
    console.log(logs);
  }
};

const runNodeInContext = (context, node) => {
  const compiledJs = jsCompiler.compile(context, node);
  try {
    vm.runInContext(compiledJs, context.macroState.vmContext);

    getOutputLogs(context);
  }
  catch (error) {
    console.log('Error compiling js:', compiledJs);
    console.log(`node: ${JSON.stringify(node, null, 2)}`);
    throw error;
  }
};

const replaceMacroCall = (context, node) => {
  if (isFnCallValueSeq(node)) {
    const values = node.get('values');
    const funcCallIndex = values.findIndex(isFunctionCall);

    const beforeFuncCall = values.slice(0, funcCallIndex);
    const functionCall = values.get(funcCallIndex);
    const afterFuncCall = values.slice(funcCallIndex + 1);

    const lookupValue = jsCompiler.compile(context, dsl.valueSeq(...beforeFuncCall));
    try {
      const macro = vm.runInContext(lookupValue, context.macroState.vmContext);

      if (_.isFunction(macro) && macro._wlt_macro) {
        const args = functionCall.get('args');
        const block = functionCall.get('block');
        const macroArgs = List([context, block]).concat(args);
        let newNode;
        try {
          newNode = macro(...macroArgs);
        }
        finally {
          getOutputLogs(context);
        }
        if (afterFuncCall.count() > 0) {
          newNode = dsl.valueSeq(newNode, ...afterFuncCall);
        }
        return newNode;
      }
    }
    catch (error) {
      //ignoring error
    }
  }
  return null;
};

const expandStatements = (context, statements) => {
  statements = statements.toArray ? statements.toArray() : statements;
  let newStatements = [];
  for (let i = 0; i < statements.length; i += 1) {
    const stmt = statements[i];
    const macroReplaced = replaceMacroCall(context, stmt);

    if (macroReplaced) {
      // Recurse in case the expanded form references other macros.
      const replacements = expandStatements(context, [macroReplaced]).toArray();
      newStatements = _.concat(newStatements, replacements);
    }
    else {
      newStatements.push(stmt);
    }
  }
  return List(newStatements);
};

const statementsNodeExpander = (context, node) =>
  node.update('statements', (statements) => expandStatements(context, statements));

const preExpanders = {
  Program: statementsNodeExpander,
  Block: statementsNodeExpander,
};

// These expanders run nodes in our VM so that any code that's defined to be available for a future
// macro
const postExpanders = {
  Def: (context, node) => {
    if (!context.useConservativeMacroExecution && context.depth === 1) {
      runNodeInContext(context, node);
    }
    return node;
  },

  Assignment: (context, node) => {
    if (!context.useConservativeMacroExecution && context.depth === 1) {
      runNodeInContext(context, node);
    }
    return node;
  },

  InfixExpression: (context, node) => {
    if (!context.useConservativeMacroExecution && context.depth === 1 &&
      node.get('operator') === '=') {
      // This is a re-assignment statement
      runNodeInContext(context, node);
    }
    return node;
  },

  Expression: (context, node) => {
    if (!context.useConservativeMacroExecution && context.depth === 1) {
      runNodeInContext(context, node);
    }
    return node;
  },

  Macro: (context, node) => {
    // Compile the js into a "let <node.symbol> = <node.fn>" statement and execute in the vm sandbox
    // It will now be available within the vm to execute things
    runNodeInContext(context, node);
    return node;
  },

  ValueSequence: (context, node) =>
    expandStatements(context, List([node])).get(0)
};

let initializeMacroState;
let expandMacros;

const createRequireFromCWD = (context) => {
  const paths = require.resolve.paths(process.cwd());

  // FUTURE add lookup for each part of the path. Each parent directory could contain a node_modules
  paths.unshift(`${context.dirname}/node_modules`);
  const fns = _.map(paths, nodeModule.createRequireFromPath);

  return (modPath) => {
    for (const fn of fns) {
      try {
        return fn(modPath);
      }
      catch (error) {
        // ignoring error
      }
    }
    throw new Error(`Could not find module [${modPath}]`);
  };
};

const wrapRequiredCode = (fullPath, code) => `
  (() => {
    const func = (exports, module, __filename, __dirname) => {
      ${code}
    };

    const exports = {};
    const module = { exports };
    func(exports, module, '${path.basename(fullPath)}', '${path.dirname(fullPath)}');

    return module.exports;
  })()`.trim();

const createRequireFn = (context) => {
  if (context.inBrowser) {
    return () => {
      throw new Error('Require not supported in browser');
    };
  }
  const normalRequire = createRequireFromCWD(context);
  return (requirePath) => {
    const willetPath = requirePath.endsWith('.wlt') ? requirePath : `${requirePath}.wlt`;
    let fullPath;
    try {
      fullPath = require.resolve(willetPath, { paths: [context.dirname] });
    }
    catch (err) {
      // ignoring path lookup issue. It must be a regular javascript file
      // if it doesn't exist the default require will throw an error
    }
    if (fullPath) {
      const source = fs.readFileSync(fullPath).toString();
      let ast = parser.parse(source);
      ast = keywordReplacer.replaceJsKeywords(ast);
      ast = semanticParser.parse(ast);

      const newDirname = path.dirname(fullPath);
      const newContext = { dirname: newDirname };
      initializeMacroState(newContext, ast);
      ast = expandMacros(newContext, ast);
      const compiledJs = jsCompiler.compile(context, ast);
      const wrapped = wrapRequiredCode(fullPath, compiledJs);

      return vm.runInContext(wrapped, context.macroState.vmContext);
    }
    // Couldn't find a willet file so just use normal javascript require
    return normalRequire(requirePath);
  };
};

const createNewVMContext = (context) => {
  const requireFn = createRequireFn(context);
  const vmContext = vm.createContext({
    process,
    module,
    require: requireFn,
    __dirname: context.dirname
  });
  if (!context.inBrowser) {
    vm.runInContext('process.chdir(__dirname)', vmContext);
  }
  vm.runInContext(`
    // So that exports and other well known global vars be available.
    exports = {};
    window = {};
    _output = '';
    console.log = (...args) => {
      _output = \`\${_output}\n\${args.join(' ')}\`;
    };
    getCapturedLogsAndReset = () => {
      const theOutput = _output;
      _output = '';
      return theOutput;
    };`, vmContext);
  return vmContext;
};

initializeMacroState = (context) => {
  if (!context.macroState) {
    context.macroState = {
      vmContext: createNewVMContext(context)
    };
    vmLoadWilletCore(context);
    context = _.clone(context);
    context.useBlockScopedVars = !context.inBrowser;
  }
  return context;
};

expandMacros = (context, astRoot) => {
  context = initializeMacroState(context);
  const preVisitor = (context2, node) => {
    const expander = preExpanders[astHelper.nodeType(node)];
    if (expander) {
      // Return a wrapper that marks the node as being done and no subsequent walking needed
      node = expander(context2, node);
    }
    return node;
  };

  const postVisitor = (context2, node) => {
    const expander = postExpanders[astHelper.nodeType(node)];
    if (expander) {
      // Return a wrapper that marks the node as being done and no subsequent walking needed
      node = expander(context2, node);
    }
    return node;
  };

  let result;
  try {
    result = astHelper.prepostwalk(context, preVisitor, postVisitor, astRoot);
  }
  catch (error) {
    console.log(error);
    console.log('Path: ', error.path);
    throw error;
  }

  return result;
};

module.exports = {
  expandMacros,
};
