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

def raise = fn (error) {
  throw(new(Error(error)))
}

def count = fn (v) {
  if (v.length) {
    v.length
  }
  elseif (v.count) {
    v.count()
  }
  else {
    raise("Value is not countable")
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
  if (block) {
    raise("and macro does not take a block")
  }
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
  if (block) {
    raise("or macro does not take a block")
  }
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

def reduce = fn (coll ...args) {
  if (!coll.reduce) {
    raise("Not a reduceable collection")
  }
  if (args.length > 1) {
    def [f memo] = args
    coll.reduce(f memo)
  }
  else {
    def [f] = args
    coll.reduce(f)
  }
}

def range = fn (start = 0 stop = Infinity step = 1) {
  Immutable.Range(start stop step)
}

def slice = fn (coll begin end) {
  let coll = toImmutable(coll)
  coll.slice(begin end)
}

def partition = fn (coll n) {
  let coll = toImmutable(coll)
  map(range(0 count(coll) n) fn(index) {
    slice(coll index index + n)
  })
}

def first = fn (coll) {
  if (coll.first) {
    coll.first()
  }
  else {
    coll.[0]
  }
}

def last = fn (coll) {
  if (coll.last) {
    coll.last()
  }
  else {
    coll.[count(coll) - 1]
  }
}

def drop = fn (coll n = 1) {
  slice(coll n)
}

def dropLast = fn (coll n = 1) {
  slice(coll 0 count(coll) - n)
}

def groupBy = fn (coll f) {
  let coll = toImmutable(coll)
  coll.groupBy(f)
}

def concat = fn (...args) {
  if (isEmpty(args)) {
    Immutable.List([])
  }
  else {
    def [coll ...iterables] = args
    let coll = toImmutable(coll)
    coll.concat(...iterables)
  }
}

def keys = fn (coll) {
  toImmutable(coll).keySeq()
}

def toSeq = fn (coll) {
  let coll = toImmutable(coll)
  if (Immutable.isKeyed(coll)) {
    coll.entrySeq()
  }
  else {
    coll.toSeq()
  }
}

def fromPairs = fn (kvPairs) {
  Immutable.Map(kvPairs)
}

def indexOf = fn (coll item) {
  let coll = toImmutable(coll)
  if (!coll.indexOf) {
    raise("Not an indexed collection")
  }
  coll.indexOf(item)
}

def get = fn (coll key) {
  toImmutable(coll).get(key)
}

def update = fn (coll key f) {
  toImmutable(coll).update(key f)
}

def getIn = fn (coll path defaultVal = undefined) {
  toImmutable(coll).getIn(path defaultVal)
}

def updateIn = fn (coll path f) {
  toImmutable(coll).updateIn(path f)
}

// let v = toImmutable(#{a: 1 b: 2 c:3})
// let v = toImmutable([1 2 3])

// v.get(1)

// merge

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
// TODO defmacro shouldn't require the "=" here.
defmacro fore = fn (block ...args) {
  def pairs = _.chunk(args, 2)
  processPairs(block, pairs)
}


let module.exports = #{
  falsey
  truthy
  isNil
  raise
  count
  isEmpty
  and
  or
  identity
  isImmutable
  toImmutable
  map
  reduce
  range
  slice
  partition
  first
  last
  drop
  dropLast
  groupBy
  concat
  keys
  toSeq
  fromPairs
  indexOf
  get
  update
  getIn
  updateIn


  isPromise
  // macros
  afn
  if
  try
  fore
  cond
  chain
}
