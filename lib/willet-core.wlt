def _ = require("lodash")
// Path to ast-helper works from lib or from compiled dist
def astHelper = require("../lib/ast-helper")
def #{ dsl } = astHelper

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

def fixTarget = fn (target) {
  def visitor = fn (context node) {
    if (node.type == "MapLiteral") {
      let node = dsl.mapDestructuring(...node.properties)
    }
    else if (node.type == "ArrayLiteral") {
      let node = dsl.arrayDestructuring(...node.values)
    }
    node
  }
  astHelper.postwalk(#{} visitor target)
}

def processPairs = fn (block #[pair ...rest]) {
  def #[target collection] = pair
  if (isEmpty(rest)) {
    def fun = dsl.func(
      #[fixTarget(target)]
      block
    )
    quote(map(unquote(collection) unquote(fun)))
  }
  else {
    def fun = dsl.func(
      #[fixTarget(target)]
      #[processPairs(block rest)]
    )
    quote(map(unquote(collection) unquote(fun)))
  }
}

// TODO improve illegal keyword errors so that it will happen _after_ parsing

// TODO support when, let etc
// TODO defmacro shouldn't require the '=' here.
defmacro fore = fn (...args) {
  def block = last(args)
  def pairs = chunk(dropLast(args), 2)
  processPairs(block, pairs)
}

let module.exports = #{
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
