const _ = require('lodash');
const Immutable = require('immutable');
const { List } = Immutable;
const astHelper = require('./ast-helper');
const jsCompiler = require('./javascript-compiler');
const vm = require('vm');
const { dsl, isFnCallValueSeq } = require('./ast-helper');
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

    const coreMacros = _.filter(_.keys(willetCore), (k) => {
      const val = willetCore[k];
      return _.isFunction(val) && val._wlt_macro;
    });
    context.macroState.macrosInScope = new Set(coreMacros);

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

const valueSeqSymbol = (node) => node.getIn(['values', 0, 'symbol']);

const runNodeInContext = (context, node) => {
  const compiledJs = jsCompiler.compile(node);
  try {
    vm.runInContext(compiledJs, context.macroState.vmContext);
  }
  catch (error) {
    console.log('Error compiling js:', compiledJs);
    console.log(`node: ${JSON.stringify(node, null, 2)}`);
    throw error;
  }
};

const nodeToMacro = (context, node) => {
  if (isFnCallValueSeq(node)) {
    const symbol = valueSeqSymbol(node);
    if (context.macroState.macrosInScope.has(symbol)) {
      const code = `(...args) => captureStdout(() => {
        return ${symbol}(...args);
      });`;
      return vm.runInContext(code, context.macroState.vmContext);
    }
  }
  return null;
};

const runMacro = (context, statements, stmtIndex, macro) => {
  const node = statements[stmtIndex];
  const args = node.getIn(['values', 1, 'args']);
  const block = node.getIn(['values', 1, 'block']);
  const rest = node.get('values').slice(2);
  // Call the macro with the ast
  const macroArgs = List([context, block]).concat(args);
  const [output, nodeResult, error] = macro(...macroArgs);

  if (output && output.trim().length > 0) {
    console.log('Macro console.log:', output);
  }

  if (error) throw error;

  if (rest.count() > 0) {
    return dsl.valueSeq(nodeResult, ...rest);
  }
  return nodeResult;
};

const expandStatements = (context, statements) => {
  statements = statements.toArray ? statements.toArray() : statements;
  let newStatements = [];
  for (let i = 0; i < statements.length; i += 1) {
    const stmt = statements[i];
    const macro = nodeToMacro(context, stmt);

    if (macro) {
      const result = runMacro(context, statements, i, macro);
      // Recurse in case the expanded form references other macros.
      const replacements = expandStatements(context, [result]).toArray();
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

const postExpanders = {
  Def: (context, node) => {
    if (context.depth === 1) {
      runNodeInContext(context, node);
    }
    return node;
  },

  Assignment: (context, node) => {
    if (context.depth === 1) {
      runNodeInContext(context, node);
    }
    return node;
  },

  InfixExpression: (context, node) => {
    if (context.depth === 1 && node.get('operator') === '=') {
      // This is a re-assignment statement
      runNodeInContext(context, node);
    }
    return node;
  },

  Expression: (context, node) => {
    if (context.depth === 1) {
      runNodeInContext(context, node);
    }
    return node;
  },

  Macro: (context, node) => {
    context.macroState.macrosInScope.add(node.get('symbol'));

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
      const compiledJs = jsCompiler.compile(ast);
      const wrapped = nodeModule.wrap(compiledJs);

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
    const captureStdout = (callback) => {
      let output = '';
      const oldLog = console.log;

      // start capture
      console.log = (...args) => {
        output = \`\${output}\n\${args.join(' ')}\`;
      };

      let error;
      let result;
      try {
        result = callback();
      }
      catch (e) {
        error = e;
      }
      finally {
        // end capture
        console.log = oldLog;
      }

      return [output, result, error];
    };`, vmContext);
  return vmContext;
};

initializeMacroState = (context) => {
  if (!context.macroState) {
    context.macroState = {
      macrosInScope: new Set(),
      vmContext: createNewVMContext(context)
    };
    vmLoadWilletCore(context);
  }
};

expandMacros = (context, astRoot) => {
  initializeMacroState(context);
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
