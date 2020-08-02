const _ = require('lodash');
const vm = require('vm');
const nodeModule = require('module');
const Immutable = require('immutable');
const { List } = Immutable;
const astHelper = require('./ast-helper');
const jsCompiler = require('./javascript-compiler');
const contextModule = require('./context');
const {
  dsl, isFnCallValueSeq, isFunctionCall, isValueSequence, isReference
} = require('./ast-helper');
const parser = require('./chevrotain-parser');
const semanticParser = require('./semantic-parser');
const keywordReplacer = require('./keyword-replacer');
const fs = require('fs');
const path = require('path');

const vmLoadWilletCore = (context) => {
  if (!context.skipCore) {
    contextModule.loadWilletCore(context);
    const vmContext = context.macroState.vmContext;

    if (context.inBrowser) {
      //eslint-disable-next-line
      const willetCore = require('../dist/willet-core');
      vmContext.Immutable = Immutable;
      vmContext.willetCore = willetCore;
      for (const k of _.keys(willetCore)) {
        vmContext[k] = willetCore[k];
      }
    }
    else {
      vm.runInContext(context.core.coreRequire, vmContext);
    }
    vm.runInContext(context.core.coreImport, vmContext);
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
  const compiledJs = jsCompiler.compile(context.compileContext, node);
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
    let macro;
    try {
      macro = vm.runInContext(lookupValue, context.macroState.vmContext);
    }
    catch (error) {
      //ignoring error
    }

    if (macro && _.isFunction(macro) && macro._wlt_macro) {
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
  return null;
};

let expandMacros;

const expandStatements = (context, statements) => {
  if (_.last(context.quoteStack) === 'quote') {
    return statements;
  }
  statements = statements.toArray ? statements.toArray() : statements;
  const newStatements = [];
  for (let i = 0; i < statements.length; i += 1) {
    const stmt = statements[i];
    const macroReplaced = replaceMacroCall(context, stmt);

    if (macroReplaced) {
      // Recurse in case the expanded form references other macros.
      const replacement = expandMacros(context, macroReplaced);
      newStatements.push(replacement);
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
  ValueSequence: (context, node) =>
    expandStatements(context, List([node])).get(0),
  Quote: (context, node) => {
    context.quoteStack.push('quote');
    return node;
  },
  Unquote: (context, node) => {
    context.quoteStack.push('unquote');
    return node;
  }
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

  InfixExpression: (context, node) => {
    if (node.get('operator') === '=') {
      // This is an assignment
      let shouldRun = !context.useConservativeMacroExecution && context.depth === 1;

      // Check for $willetCompilerContext calls in code to manipulate the context
      if (isValueSequence(node.get('left'))) {
        const value = node.getIn(['left', 'values', 0]);
        if (isReference(value) && value.get('symbol') === '$willetCompilerContext') {
          const newNode = node.setIn(['left', 'values', 0, 'symbol'], 'context');
          const code = jsCompiler.compile(context, newNode);
          // eslint-disable-next-line no-eval
          eval(code);

          // Do nothing node
          node = dsl.staticJs('');
          shouldRun = false;
        }
      }

      if (shouldRun) {
        // This is a re-assignment statement
        runNodeInContext(context, node);
      }
    }
    return node;
  },

  Macro: (context, node) => {
    if (context.useConservativeMacroExecution) {
      throw new Error('Conservative macro execution is on. Macros can\'t be evalutated');
    }
    // Compile the js into a "let <node.symbol> = <node.fn>" statement and execute in the vm sandbox
    // It will now be available within the vm to execute things
    runNodeInContext(context, node);
    return node;
  },

  Quote: (context, node) => {
    context.quoteStack.pop();
    return node;
  },

  Unquote: (context, node) => {
    context.quoteStack.pop();
    return node;
  }
};

let initializeMacroState;

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
      const compiledJs = jsCompiler.compile(context.compileContext, ast);
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
    context.compileContext = _.clone(context);
    if (context.inBrowser) {
      context.compileContext.useBlockScopedVars = false;
    }
    context.quoteStack = [];
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
