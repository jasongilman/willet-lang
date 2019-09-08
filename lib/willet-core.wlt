def _ = require("lodash")
def #{ dsl } = require("./ast-helper")

def chunk = _.chunk
def last = _.last
def slice = _.slice
def drop = _.drop
def map = _.map
def isEmpty = _.isEmpty

// TODO make it so that def can be run multiple times in a row without getting the "identifer has
// already been declared error"

def processPairs = (block [pair ...rest]) => {
  def [ref collection] = pair
  if (isEmpty(rest)) {
    def fn = dsl.func(
      [dsl.symbolAssignment(ref.symbol)],
      block
    )
    quote(map(unquote(collection), unquote(fn)))
  }
}


// b = quote(
// 5 + jason
// )
// s = processPairs(
//   [b]
//   [[quote(jason) quote(items)]]
// )

// console.log(JSON.stringify(s, null, 2))

defmacro for = (...args) => {
  def block = last(args)
  def pairs = chunk(drop(args), 2)
  processPairs(block, pairs)
};


for( i [ 1 2 3]) {
  i
}


macroExports = {
  for
};
