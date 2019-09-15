#{_willet: #{skipCore: true}}

def _ = require("lodash")
// Path to ast-helper works from lib or from compiled dist
def #{ dsl } = require("../lib/ast-helper")

// TODO core methods to add
// macroexpand
// to_js (or something like that) - returns compiled javascript of code.

def identity = _.identity
def chunk = _.chunk
def first = _.first
def last = _.last
def slice = _.slice
def drop = _.drop
def dropLast = _.dropRight
def map = _.map
def isEmpty = _.isEmpty

def processPairs = (block [pair ...rest]) => {
  def [ref collection] = pair
  if (isEmpty(rest)) {
    def fn = dsl.func(
      [dsl.symbolAssignment(ref.symbol)]
      block
    )
    quote(map(unquote(collection) unquote(fn)))
  }
  else {
    def fn = dsl.func(
      [dsl.symbolAssignment(ref.symbol)]
      [processPairs(block rest)]
    )
    quote(map(unquote(collection) unquote(fn)))
  }
}

// TODO improve illegal keyword errors so that it will happen _after_ parsing

// TODO support when, let etc
defmacro fore = (...args) => {
  def block = last(args)
  def pairs = chunk(dropLast(args), 2)
  processPairs(block, pairs)
}

module.exports = #{
  chunk,
  first,
  last,
  slice,
  drop,
  dropLast,
  map,
  isEmpty,
  fore
}
