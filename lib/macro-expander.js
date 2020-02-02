const _ = require('lodash');
const { List, Map } = require('immutable');
const astHelper = require('./ast-helper');
const jsCompiler = require('./javascript-compiler');
const parser = require('../parser');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { dsl } = require('./ast-helper');
const nodeModule = require('module');

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
    const coreRequire = `const willetCore = require("${pathToWilletCore}");`;
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

// FUTURE add these helpers to dsl
const isReference = (node) => astHelper.nodeType(node) === 'Reference';
const isFunctionCall = (node) => astHelper.nodeType(node) === 'FunctionCall';

const isFnCallValueSeq = (node) => {
  const type = astHelper.nodeType(node);
  const values = node.get('values');
  return type === 'ValueSequence' &&
    values.count() >= 2 &&
    isReference(values.first()) &&
    isFunctionCall(values.get(1));
};

const valueSeqSymbol = (node) => node.getIn(['values', 0, 'symbol']);

const runNodeInContext = (context, node) => {
  const compiledJs = jsCompiler.compile(node);
  try {
    vm.runInContext(compiledJs, context.macroState.vmContext);
  }
  catch (error) {
    console.log('Error compiling js:', compiledJs);
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

const runMacroWithTerms = (context, statements, stmtIndex, macro) => {
  const terms = macro._wlt_macro_terms;
  const macroStatements = [statements[stmtIndex]];
  stmtIndex += 1;
  let termIndex = 1;
  while (
    stmtIndex < statements.length &&
    termIndex < terms.count() &&
    isFnCallValueSeq(statements[stmtIndex])
  ) {
    // TODO if the term doesn't support args or blocks we should throw an error

    // If the term doesn't match this then we don't increment the statement index. We'll
    // continue looking through possible matching terms
    if (valueSeqSymbol(statements[stmtIndex]) === terms.get(termIndex).get('term')) {
      macroStatements.push(statements[stmtIndex]);
      stmtIndex += 1;
    }
    else if (!terms.get(termIndex).get('optional')) {
      throw new Error(`[${terms.get(termIndex).get('term')}] was not present and is required`);
    }
    termIndex += 1;
  }
  // Undo the look ahead for the next iteration
  stmtIndex -= 1;

  const macroArgs = _.reduce(macroStatements, (m, macroStmt) => {
    const args = macroStmt.getIn(['values', 1, 'args']);
    const block = macroStmt.getIn(['values', 1, 'block']);
    return m.set(valueSeqSymbol(macroStmt), Map({ args, block }));
  }, Map());
  const result = macro(macroArgs);
  return [result, stmtIndex];
};

const runMacro = (context, statements, stmtIndex, macro) => {
  let nodeResult;
  if (macro._wlt_macro_terms) {
    ([nodeResult, stmtIndex] = runMacroWithTerms(context, statements, stmtIndex, macro));
  }
  else {
    const node = statements[stmtIndex];
    const args = node.getIn(['values', 1, 'args']);
    const block = node.getIn(['values', 1, 'block']);
    const rest = node.get('values').slice(2);
    // Call the macro with the ast
    const macroArgs = List([block]).concat(args);
    nodeResult = macro(...macroArgs);

    if (rest.count() > 0) {
      nodeResult = dsl.valueSeq(nodeResult, ...rest);
    }
  }
  return [nodeResult, stmtIndex];
};

const expandStatements = (context, statements) => {
  statements = statements.toArray ? statements.toArray() : statements;
  let newStatements = [];
  for (let i = 0; i < statements.length; i += 1) {
    const stmt = statements[i];
    const macro = nodeToMacro(context, stmt);

    if (macro) {
      const [result, newStmtIndex] = runMacro(context, statements, i, macro);
      i = newStmtIndex;
      let replacements = result;
      if (!_.isArray(replacements)) {
        replacements = [replacements];
      }
      // Recurse in case the expanded form references other macros.
      replacements = expandStatements(context, replacements).toArray();
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

const createRequireFromCWD = () => {
  const paths = require.resolve.paths(process.cwd());
  const fns = _.map(paths, nodeModule.createRequireFromPath);

  return (modPath) => {
    for (const fn of fns) {
      try {
        return fn(modPath);
      }
      catch (error) {
        return null;
      }
    }
    throw new Error(`Could not find module [${modPath}]`);
  };
};

const createRequireFn = (context) => {
  const normalRequire = createRequireFromCWD();
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
    result = astHelper.prepostwalk(context, [preVisitor, postVisitor], astRoot);
  }
  catch (error) {
    console.log(error);
    console.log('Path: ', error.path);
    throw error;
  }

  // Insert willet core
  if (!context.skipCore) {
    result = result.update('statements', (s) => s.concat([
      dsl.staticJs(CORE_END),
      dsl.staticJs(context.core.coreImport),
      // TODO the path required here is wrong (probably)
      dsl.staticJs(context.core.coreRequire),
      dsl.staticJs(CORE_START)
    ]));
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
