const _ = require('lodash');
const { List } = require('immutable');
const astHelper = require('./ast-helper');
const jsCompiler = require('./javascript-compiler');
const vm = require('vm');
const { dsl, isFnCallValueSeq } = require('./ast-helper');
const nodeModule = require('module');
// TODO related to commented out code below
// const parser = require('./chevrotain-parser');
// const fs = require('fs');
// const path = require('path');

const CORE_START = '/* WILLET_CORE_START */';
const CORE_END = '/* WILLET_CORE_END */';

const loadWilletCore = (context) => {
  if (!context.skipCore) {
    //eslint-disable-next-line
    const willetCore = require('../dist/willet-core');

    const coreMacros = _.filter(_.keys(willetCore), (k) => {
      const val = willetCore[k];
      return _.isFunction(val) && val._wlt_macro;
    });

    const pathToWilletCore = `${__dirname}/../dist/willet-core`;
    const coreRequire = `
    const Immutable = require('immutable');
    const willetCore = require("${pathToWilletCore}");
    `;
    const coreImport = _.map(
      _.keys(willetCore),
      (k) => `const ${k} = willetCore.${k};`
    ).join('\n');

    context.core = {
      coreMacros,
      coreRequire,
      coreImport
    };
  }
};

const vmLoadWilletCore = (context) => {
  loadWilletCore(context);
  if (!context.skipCore) {
    const { coreMacros, coreRequire, coreImport } = context.core;
    context.macroState.macrosInScope = new Set(coreMacros);
    const vmContext = context.macroState.vmContext;
    vm.runInContext(coreRequire, vmContext);
    vm.runInContext(coreImport, vmContext);
  }
};

// FUTURE hygenic macros

// FUTURE add main function at top level (To prevent side effects. Anything else at the top
// level that's not a var declaration is not allowed)

const valueSeqSymbol = (node) => node.getIn(['values', 0, 'symbol']);

const runNodeInContext = (context, node) => {
  const compiledJs = jsCompiler.compile(node);
  console.log('-----------------------------------');
  console.log('compiledJs:', compiledJs);
  try {
    const result = vm.runInContext(compiledJs, context.macroState.vmContext);
    console.log('-----------------------------------');
    console.log('result:', result);
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
      return vm.runInContext(symbol, context.macroState.vmContext);
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
  const macroArgs = List([block]).concat(args);
  let nodeResult = macro(...macroArgs);

  if (rest.count() > 0) {
    nodeResult = dsl.valueSeq(nodeResult, ...rest);
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
  // TODO add lookup for each part of the path
  paths.unshift(`${context.dirname}/node_modules`);

  console.log('-----------------------------------');
  console.log(`paths: ${JSON.stringify(paths, null, 2)}`);
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
  const normalRequire = createRequireFromCWD(context);
  return (requirePath) => {
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
      // TODO this needs to be updated to use keyword-replacer
      // and the semantic parser
      throw new Error('TODO');
      // const contents = fs.readFileSync(fullPath).toString();
      // const newDirname = path.dirname(fullPath);
      // const parsed = parser.parse(contents);
      // const newContext = { dirname: newDirname };
      // initializeMacroState(newContext, parsed);
      // const expanded = expandMacros(newContext, parsed);
      // const compiledJs = jsCompiler.compile(expanded);
      // return vm.runInContext(compiledJs, context.macroState.vmContext);
    }
    // Couldn't find a willet file so just use normal javascript require
    return normalRequire(requirePath);
  };
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
  if (!context.macroState) {
    context.macroState = {
      macrosInScope: new Set(),
      vmContext: createNewVMContext(createRequireFn(context), context.dirname)
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

  // Insert willet core
  if (!context.skipCore) {
    result = result.update('statements', (s) => List([
      dsl.staticJs(CORE_START),
      dsl.staticJs(context.core.coreRequire),
      dsl.staticJs(context.core.coreImport),
      dsl.staticJs(CORE_END),
    ]).concat(s));
  }

  return result;
};

module.exports = {
  CORE_START,
  CORE_END,
  expandMacros,
  // For tests
  loadWilletCore
};
