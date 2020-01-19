const _ = require('lodash');
const astHelper = require('./ast-helper');
const jsCompiler = require('./javascript-compiler');
const parser = require('../parser');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const { dsl } = require('./ast-helper');

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

// TODO hygenic macros

// TODO add main function at top level

// TODO add these helpers to dsl
const isReference = (node) => node.type === 'Reference';
const isFunctionCall = (node) => node.type === 'FunctionCall';

const isFnCallValueSeq = ({ type, values }) =>
  type === 'ValueSequence' && values.length >= 2 && isReference(values[0]) &&
  isFunctionCall(values[1]);

const valueSeqSymbol = ({ values }) => values[0].symbol;

const runNodeInContext = (context, node) => {
  const compiledJs = jsCompiler.compile(node);
  vm.runInContext(compiledJs, context.macroState.vmContext);
};

const nodeToMacro = (context, node) => {
  if (isFnCallValueSeq(node)) {
    // TODO use valueSeqSymbol
    const [{ symbol }] = node.values;
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
    termIndex < terms.length &&
    isFnCallValueSeq(statements[stmtIndex])
  ) {
    // TODO if the term doesn't support args or blocks we should throw an error

    // If the term doesn't match this then we don't increment the statement index. We'll
    // continue looking through possible matching terms
    if (valueSeqSymbol(statements[stmtIndex]) === terms[termIndex].term) {
      macroStatements.push(statements[stmtIndex]);
      stmtIndex += 1;
    }
    else if (!terms[termIndex].optional) {
      throw new Error(`[${terms[termIndex].term}] was not present and is required`);
    }
    termIndex += 1;
  }
  // Undo the look ahead for the next iteration
  stmtIndex -= 1;

  const macroArgs = _.reduce(macroStatements, (m, macroStmt) => {
    const { args, block } = macroStmt.values[1];
    m[valueSeqSymbol(macroStmt)] = { args, block };
    return m;
  }, {});
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
    const [_ignored, { args, block }, ...subsequent] = node.values;
    // Call the macro with the ast
    const macroArgs = _.concat(args, [block]);
    const replacement = macro(...macroArgs);

    if (_.isEmpty(subsequent)) {
      // The value sequence is only the function call
      nodeResult = replacement;
    }
    else {
      // TODO test this
      // There are other subsequent calls after the macro
      nodeResult = _.clone(node);
      node.values = _.concat([replacement], subsequent);
    }
  }
  return [nodeResult, stmtIndex];
};

const expandStatements = (context, statements) => {
  let newStatements = [];
  for (let i = 0; i < statements.length; i += 1) {
    const stmt = statements[i];
    const macro = nodeToMacro(context, stmt);

    if (macro) {
      const [result, newStmtIndex] = runMacro(context, statements, i, macro);
      let replacement = result;
      i = newStmtIndex;
      if (!_.isArray(replacement)) {
        replacement = [replacement];
      }
      // Recurse in case the expanded form references other macros.
      replacement = expandStatements(context, replacement);
      newStatements = _.concat(newStatements, replacement);
    }
    else {
      newStatements.push(stmt);
    }
  }
  return newStatements;
};

const statementsNodeExpander = (context, node) => {
  const { statements } = node;
  node.statements = expandStatements(context, statements);
  return node;
};

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
    context.macroState.macrosInScope.add(node.symbol);

    // Compile the js into a "let <node.symbol> = <node.fn>" statement and execute in the vm sandbox
    // It will now be available within the vm to execute things
    runNodeInContext(context, node);
    return node;
  },

  ValueSequence: (context, node) => _.first(expandStatements(context, [node]))
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
  context.macroState = {
    macrosInScope: new Set(),
    vmContext: createNewVMContext(createRequireFn(context), context.dirname)
  };
  vmLoadWilletCore(context);
};

expandMacros = (context, astRoot) => {
  // Allow mutating astRoot without changin it for caller.
  astRoot = _.cloneDeep(astRoot);

  initializeMacroState(context);
  const preVisitor = (context2, node) => {
    const expander = preExpanders[node.type];
    if (expander) {
      // Return a wrapper that marks the node as being done and no subsequent walking needed
      node = expander(context2, node);
    }
    return node;
  };

  const postVisitor = (context2, node) => {
    const expander = postExpanders[node.type];
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
    result.statements.unshift(dsl.staticJs(context.core.coreImport));
    // TODO the path required here is wrong (probably)
    result.statements.unshift(dsl.staticJs(context.core.coreRequire));
  }

  return result;
};

module.exports = {
  expandMacros,
  // For tests
  loadWilletCore
};
