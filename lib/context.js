// This will also detect when we're running in an environment like an atom plugin.
const inBrowser = typeof window !== 'undefined';

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
  inBrowser
};
