const _ = require('lodash');
const Immutable = require('immutable');
// This will also detect when we're running in an environment like an atom plugin.
const inBrowser = typeof window !== 'undefined';

const loadWilletCore = (context) => {
  // Don't load if skipCore is true or core is already loaded
  if (!context.skipCore && !context.core) {
    //eslint-disable-next-line
    const willetCore = require('../dist/willet-core');
    context.core = {};

    if (context.inBrowser) {
      // eslint-disable-next-line no-undef
      window.Immutable = Immutable;
      // eslint-disable-next-line no-undef
      window.willetCore = willetCore;
    }
    else {
      const coreRequire = `
      const Immutable = require('immutable');
      const willetCore = require('willet/dist/willet-core');`;
      context.core.coreRequire = coreRequire;
    }
    const def = context.useBlockScopedVars ? 'const' : 'var';

    const coreImport = _.map(
      _.keys(willetCore),
      (k) => `${def} ${k} = willetCore.${k};`
    ).join('\n');
    context.core.coreImport = coreImport;
  }
};

// FUTURE change context to be immutable.

// The context can be manipulated at compile time by using the special variable
// $willetCompilerContext. This can allow quick changes in dynamic environments.
const createContext = (dirname = '.') => ({
  dirname,
  skipCore: false,
  inBrowser,
  useBlockScopedVars: true, // using "var" if false
  useConservativeMacroExecution: false
});

module.exports = {
  createContext,
  loadWilletCore,
  inBrowser
};
