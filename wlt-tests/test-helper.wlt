const #{ dsl } = require("../lib/ast-helper")
// FUTURE make sure a require from this file works as well

const increment = #(a) => a + 1
const decrement = #(a) => a - 1

defmacro macroInRequiredFile = #(context block ...args) =>
  dsl.number(count(args))

module.exports = jsObject(#{
  increment,
  decrement,
  macroInRequiredFile
})
