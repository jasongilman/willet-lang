// TODO can we remove lodash dependency?
def _ = require("lodash")
def Immutable = require("immutable")
// Path to ast-helper works from lib or from compiled dist
def astHelper = require("../lib/ast-helper")
def #{ dsl } = astHelper

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
    dsl.ifList(..._.map(_.toPairs(parts), fn([key value]) {
      ifFormToDsl.[key](value)
    }))
  }
}

// FUTURE core methods to add
// macroexpand
// to_js (or something like that) - returns compiled javascript of code.


def falsey = fn (v) {
  staticjs("v === false || v === null || v === undefined")
}

def truthy = fn (v) {
  staticjs("v !== false && v !== null && v !== undefined")
}

def isNil = fn (v) {
  staticjs("v === null || v === undefined")
}

def count = fn (v) {
  if (v.length) {
    v.length
  }
  elseif (v.count) {
    v.count()
  }
  else {
    throw(new(Error("Value is not countable")))
  }
}

def isEmpty = fn (v) {
  if (isNil(v)) {
    true
  }
  else {
    count(v) == 0
  }
}

defmacro and = fn(block ...args) {
  def andhelper = fn([form ...rest]) {
    def elseResult = {
      if (isEmpty(rest)) {
        quote(true)
      }
      else {
        andhelper(rest)
      }
    }

    quote() {
      def formR = unquote(form)
      if (!formR) {
        false
      }
      else {
        unquote(elseResult)
      }
    }
  }

  andhelper(args)
}

defmacro or = fn(block ...args) {
  def orhelper = fn([form ...rest]) {
    def elseResult = {
      if (isEmpty(rest)) {
        quote(false)
      }
      else {
        orhelper(rest)
      }
    }

    quote() {
      def formR = unquote(form)
      if (formR) {
        true
      }
      else {
        unquote(elseResult)
      }
    }
  }
  orhelper(args)
}

def identity = fn (v) { v }

def isImmutable = Immutable.isImmutable

def toImmutable = fn (v) {
  if (isImmutable(v)) {
    v
  }
  else {
    Immutable.fromJS(v)
  }
}

def map = fn (coll f) {
  toImmutable(coll).map(f)
}

def range = fn (start = 0 stop = Infinity step = 1) {
  Immutable.Range(start stop step)
}

// TODO slice

def partition = fn (coll n) {
  let coll = toImmutable(coll)
  map(range(0 count(coll) n) fn(index) {
    coll.slice(index index + n)
  })
}


// def chunk = _.chunk
// def first = _.first
// def last = _.last
// def slice = _.slice
// def drop = _.drop
// def dropLast = _.dropRight
// def map = _.map
// def reduce = _.reduce
// def groupBy = _.groupBy
// def concat = _.concat
// def isEmpty = _.isEmpty
// def keys = _.keys
// def toPairs = _.toPairs
// def fromPairs = _.fromPairs
// def indexOf = _.indexOf
// def isArray = _.isArray
// def isPlainObject = _.isPlainObject
// def isNil = _.isNil
// def clone = _.clone
// def cloneDeep = _.cloneDeep
// def get = _.get

def isPromise = fn (p) {
  instanceof(p Promise)
}

// Creates an async function. Eventually I'd like to consider a better way to do this.
// "afn" isn't very guessable.
defmacro afn = fn (block ...args) {
  dsl.func(args, block, true)
}

defmacro cond = fn(block) {
  def blockWrap = fn(v) {
    if (v.type == "Block") {
      dsl.block(...v.statements)
    }
    else {
      dsl.block(v)
    }
  }
  def pairs = _.chunk(block.statements, 2)
  dsl.ifList(..._.map(pairs, fn ([conditional result] index) {
    if (index == 0) {
      dsl.ifNode(conditional blockWrap(result))
    }
    elseif (conditional.type == "Reference" && conditional.symbol == "else$wlt") {
      dsl.elseNode(blockWrap(result))
    }
    else {
      dsl.elseIfNode(conditional blockWrap(result))
    }
  }))
}

defmacro chain = fn(block ...args) {
  def calls = block.statements
  _.reduce(calls fn (result call) {
    def newCall = cond {
      call.type == "ValueSequence" && _.get(call "values[1].type") == "FunctionCall"
      _.cloneDeep(call)
      call.type == "Reference"
      dsl.valueSeq(call dsl.functionCall())
      else
      // TODO add support for macro context argument that will allow better error reporting
      throw(new(Error("Invalid arguments passed to chain")))
    }
    let result = cond { _.isArray(result) result else [result] }

    let newCall.values.[1].args = _.concat(result newCall.values.[1].args)
    newCall
  } args)
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

def processPairs = fn (block [pair ...rest]) {
  def [target collection] = pair
  if (_.isEmpty(rest)) {
    def fun = dsl.func([target] block)
    quote(_.map(unquote(collection) unquote(fun)))
  }
  else {
    def fun = dsl.func([target] [processPairs(block rest)])
    quote(_.map(unquote(collection) unquote(fun)))
  }
}

// TODO improve illegal keyword errors so that it will happen _after_ parsing

// TODO support when, let etc
// TODO defmacro shouldn't require the '=' here.
defmacro fore = fn (block ...args) {
  def pairs = _.chunk(args, 2)
  processPairs(block, pairs)
}


let module.exports = #{
  // chunk
  // first
  // last
  // slice
  // drop
  // dropLast
  // map
  // reduce
  // groupBy
  // concat
  // indexOf
  // isEmpty
  // keys
  // toPairs
  // fromPairs
  // isArray
  // isPlainObject
  // isNil
  // clone
  // cloneDeep
  // get

  // helpers
  falsey
  truthy
  isNil
  count
  isEmpty
  and
  or

  identity
  isImmutable
  toImmutable
  map
  range
  partition

  isPromise
  // macros
  afn
  if
  try
  fore
  cond
  chain
}
