def Immutable = require("immutable")
// Path to ast-helper works from lib or from compiled dist
def astHelper = require("../lib/ast-helper")
def #{ dsl } = astHelper

def isImmutable = Immutable.isImmutable

def ifFormToDsl = #{
  if: fn(node) {
    let node = Immutable.fromJS(node)
    def cond = node.getIn(["args" 0])
    def block = node.get("block")
    dsl.ifNode(cond block)
  }
  elseif: fn(node) {
    let node = Immutable.fromJS(node)
    def cond = node.getIn(["args" 0])
    def block = node.get("block")
    dsl.elseIfNode(cond block)
  }
  else: fn(node) {
    let node = Immutable.fromJS(node)
    dsl.elseNode(node.get("block"))
  }
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
    dsl.ifList(...parts.entrySeq().map(fn([key value]) {
      ifFormToDsl.get(key, fn () { `${key} NOTFOUND` }).(value)
    }))
  }
}

def toImmutable = fn (v) {
  if (isImmutable(v)) {
    v
  }
  else {
    Immutable.fromJS(v)
  }
}

// FUTURE core methods to add
// macroexpand
// to_js (or something like that) - returns compiled javascript of code.

def raise = fn (error) {
  throw(new(Error(error)))
}

def falsey = fn (v) {
  staticjs("v === false || v === null || v === undefined")
}

def truthy = fn (v) {
  staticjs("v !== false && v !== null && v !== undefined")
}

def isNil = fn (v) {
  staticjs("v === null || v === undefined")
}

// Allows creating a regular javascript object.
defmacro jsObject = fn (block obj) {
  if (block) {
    raise("jsObject macro does not take a block")
  }
  if (obj.get("type") != "MapLiteral") {
    raise("jsObject macro must contain a map literal")
  }
  obj.set("js" true)
}

// Allows creating a regular javascript array from a willet array.
// Must be passed
defmacro jsArray = fn (block list) {
  if (block) {
    raise("jsArray macro does not take a block")
  }
  if (list.get("type") != "ArrayLiteral") {
    raise("jsArray macro must contain a array literal")
  }
  list.set("js" true)
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

def map = fn (coll f) {
  // TODO change this to check if it's keyed and call entrySeq
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

def filter = fn(coll f) {
  // TODO change this to check if it's keyed and call entrySeq
  toImmutable(coll).filter(f)
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

def getIn = fn (coll path defaultVal = undefined) {
  toImmutable(coll).getIn(path defaultVal)
}

def set = fn (coll key) {
  toImmutable(coll).set(key)
}

def setIn = fn (coll path defaultVal = undefined) {
  toImmutable(coll).setIn(path defaultVal)
}

def update = fn (coll key f) {
  toImmutable(coll).update(key f)
}

def updateIn = fn (coll path f) {
  toImmutable(coll).updateIn(path f)
}

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
      dsl.block(...get(v "statements"))
    }
    else {
      dsl.block(v)
    }
  }
  def pairs = partition(get(block "statements") 2)
  dsl.ifList(...map(pairs, fn ([conditional result] index) {
    if (index == 0) {
      dsl.ifNode(conditional blockWrap(result))
    }
    elseif (get(conditional "type") == "Reference" && get(conditional "symbol") == "else$wlt") {
      dsl.elseNode(blockWrap(result))
    }
    else {
      dsl.elseIfNode(conditional blockWrap(result))
    }
  }))
}

defmacro chain = fn(block ...args) {
  def calls = get(block "statements")
  reduce(calls fn (result call) {
    def newCall = cond {
      get(call "type") == "ValueSequence" && getIn(call ["values" 1 "type"]) == "FunctionCall"
      call

      get(call "type") == "Reference"
      dsl.valueSeq(call dsl.functionCall())

      else
      // TODO add support for macro context argument that will allow better error reporting
      raise("Invalid arguments passed to chain")
    }
    let result = cond { Immutable.List.isList(result) result else [result] }

    updateIn(newCall ["values" 1 "args"] fn(v) { concat(result v) })
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
    def catch = get(parts "catch")
    def errorSymbol
    def catchBlock
    if (catch) {
      let errorSymbol = getIn(catch ["args" 0 "symbol"])
      let catchBlock = get(catch "block")
    }
    def finallyBlock
    if (get(parts "finally")) {
      let finallyBlock = getIn(parts ["finally" "block"])
    }
    dsl.tryCatch(getIn(parts ["try" "block"]), errorSymbol, catchBlock, finallyBlock)
  }
}

def processPairs = fn (block [pair ...rest]) {
  def [target collection] = pair
  if (isEmpty(rest)) {
    def fun = dsl.func([target] block)
    quote(map(unquote(collection) unquote(fun)))
  }
  else {
    def fun = dsl.func([target] [processPairs(block rest)])
    quote(map(unquote(collection) unquote(fun)))
  }
}

// FUTURE support when, let etc
defmacro fore = fn (block ...args) {
  def pairs = partition(args 2)
  processPairs(block pairs)
}

// TODO equals (and should accept multiple arguments)

let module.exports = jsObject(#{
  falsey
  truthy
  isNil
  raise
  jsObject
  jsArray
  count
  isEmpty
  and
  or
  identity
  isImmutable
  toImmutable
  map
  reduce
  filter
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
})
