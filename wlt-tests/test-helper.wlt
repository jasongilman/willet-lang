// TODO make sure a require from this file works as well

const increment = #(a) => a + 1
const decrement = #(a) => a - 1

module.exports = jsObject(#{
  increment,
  decrement
})
