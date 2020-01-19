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
def keys = _.keys
def toPairs = _.toPairs

def ifFormToDsl = #{
  if: fn(#{ args:[cond] block }) { dsl.ifNode(cond block) }
  elseif: fn(#{ args:[cond] block }) { dsl.elseIfNode(cond block) }
  else: fn(#{ block }) { dsl.elseNode(block) }
}

defmacro if = #{
  terms: [
    #{
      term: "if$wlt"
      acceptsArgs: true
      acceptsBlock: true
    }
    #{
      term: "elseif"
      acceptsArgs: true
      acceptsBlock: true
      optional: true
    }
    #{
      term: "else$wlt"
      acceptsBlock: true
      optional: true
    }
  ]
  handler: fn (parts) {
    dsl.ifList(...map(toPairs(parts), fn([key value]) {
      ifFormToDsl.[key](value)
    }))
  }
}

defmacro try = #{
  terms: [
    #{
      term: "try$wlt"
      acceptsArgs: false
      acceptsBlock: true
    }
    #{
      term: "catch$wlt"
      acceptsArgs: true
      acceptsBlock: true
      optional: true
    }
    #{
      term: "finally$wlt"
      acceptsArgs: false
      acceptsBlock: true
      optional: true
    }
  ]
  handler: fn (parts) {
    def catch = parts.catch
    def errorSymbol
    def catchBlock
    if (catch) {
      let errorSymbol = catch.args.[0].symbol
      let catchBlock = catch.block
    }
    def finallyBlock
    if (parts.finally) {
      let finallyBlock = parts.finally.block
    }
    dsl.tryCatch(parts.try.block, errorSymbol, catchBlock, finallyBlock)
  }
}

def fixTarget = fn (target) {
  def visitor = fn (context node) {
    if (node.type == "MapLiteral") {
      dsl.mapDestructuring(...node.properties)
    }
    elseif (node.type == "ArrayLiteral") {
      dsl.arrayDestructuring(...node.values)
    }
    else {
      node
    }
  }
  astHelper.postwalk(#{} visitor target)
}

def processPairs = fn (block [pair ...rest]) {
  def [target collection] = pair
  if (isEmpty(rest)) {
    def fun = dsl.func(
      [fixTarget(target)]
      block
    )
    quote(map(unquote(collection) unquote(fun)))
  }
  else {
    def fun = dsl.func(
      [fixTarget(target)]
      [processPairs(block rest)]
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
  keys,
  toPairs,
  if,
  try,
  fore
}
