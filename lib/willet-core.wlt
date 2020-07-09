const Immutable = require("immutable")
const wltCompiler = require("../lib/willet-compiler")
const macroExpander = require("../lib/macro-expander")
// Path to ast-helper works from lib or from compiled dist
const astHelper = require("../lib/ast-helper")
const #{
  dsl isMapLiteral isArrayLiteral isBlock isReference isValueSequence isFunctionCall
  isStringLiteral
} = astHelper

const isImmutable = Immutable.isImmutable

const toImmutable = #(v) => {
  if (v == null || v == undefined) {
    []
  }
  elseif (isImmutable(v)) {
    v
  }
  else {
    Immutable.fromJS(v)
  }
}
// FUTURE core methods to add
// to_js (or something like that) - returns compiled javascript of code.

const raise = #(error) => {
  throw new Error(error)
}

const falsey = #(v) =>
  staticjs("v === false || v === null || v === undefined")

const truthy = #(v) =>
  staticjs("v !== false && v !== null && v !== undefined")

const isNil = #(v) =>
  staticjs("v === null || v === undefined")

defmacro jsObject = #(context block obj) => {
  if (block) {
    raise("jsObject macro does not take a block")
  }
  if (!isMapLiteral(obj)) {
    raise("jsObject macro must contain a map literal")
  }
  obj.set("js" true)
}

// Allows creating a regular javascript array from a wilarray.
defmacro jsArray = #(context block list) => {
  if (block) {
    raise("jsArray macro does not take a block")
  }
  if (!isArrayLiteral(list)) {
    raise("jsArray macro must contain a array literal")
  }
  list.set("js" true)
}

const prettyLog = #(v) => {
  console.log(JSON.stringify(v null 2))
  v
}

const count = #(v) => {
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

const isEmpty = #(v) => {
  if (isNil(v)) {
    true
  }
  else {
    count(v) == 0
  }
}

// Forces evaluation if s is a lazy sequence.
const doAll = #(s) => {
  if (Immutable.Seq.isSeq(s)) {
    s.cacheResult()
  }
  else {
    s
  }
}

defmacro and = #(context block ...args) => {
  if (block) {
    raise("and macro does not take a block")
  }
  const andhelper = #([form ...rest]) => {
    const elseResult = {
      if (isEmpty(rest)) {
        quote(true)
      }
      else {
        andhelper(rest)
      }
    }

    quote {
      const formR = unquote(form)
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

defmacro or = #(context block ...args) => {
  if (block) {
    raise("or macro does not take a block")
  }
  const orhelper = #([form ...rest]) => {
    const elseResult = {
      if (isEmpty(rest)) {
        quote(false)
      }
      else {
        orhelper(rest)
      }
    }

    quote() {
      const formR = unquote(form)
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

defmacro macroexpandRaw = #(context block ...args) => {
  if (block) {
    raise("macroexpand does not take a block")
  }
  dsl.immutableLiteral(first(args))
}

defmacro macroexpand = #(context block ...args) => {
  if (block) {
    raise("macroexpand does not take a block")
  }
  const expanded = macroExpander.expandMacros(context first(args))
  dsl.string(wltCompiler.compile(expanded))
}

const identity = #(v) => v

const map = #(coll f) =>
  // FUTURE change this to check if it's keyed and call entrySeq
  toImmutable(coll).map(f)

const flatMap = #(coll f) =>
  // FUTURE change this to check if it's keyed and call entrySeq
  toImmutable(coll).flatMap(f)

const reduce = #(coll ...args) => {
  if (!coll.reduce) {
    raise("Not a reduceable collection")
  }
  if (args.length > 1) {
    const [f memo] = args
    coll.reduce(f memo)
  }
  else {
    const [f] = args
    coll.reduce(f)
  }
}

const filter = #(coll f) =>
  // FUTURE change this to check if it's keyed and call entrySeq
  toImmutable(coll).filter(f)

const range = #(start = 0 stop = Infinity step = 1) =>
  Immutable.Range(start stop step)

const slice = #(coll begin end) => {
  coll = toImmutable(coll)
  coll.slice(begin end)
}

const partition = #(coll n) => {
  coll = toImmutable(coll)
  map(range(0 count(coll) n) #(index) => {
    slice(coll index index + n)
  })
}

const first = #(coll) => {
  if (coll) {
    if (coll.first) {
      coll.first()
    }
    else {
      coll.[0]
    }
  }
}

const last = #(coll) => {
  if (coll) {
    if (coll.last) {
      coll.last()
    }
    else {
      coll.[count(coll) - 1]
    }
  }
}

const sort = #(coll ...args) =>
  toImmutable(coll).sort(...args)

const sortBy = #(coll f) =>
  toImmutable(coll).sortBy(f)

const take = #(coll n) =>
  toImmutable(coll).take(n)

const drop = #(coll n = 1) =>
  slice(coll n)

const dropLast = #(coll n = 1) =>
  slice(coll 0 count(coll) - n)

const takeWhile = #(coll cond) =>
  toImmutable(coll).takeWhile(cond)

const dropWhile = #(coll cond) =>
  toImmutable(coll).skipWhile(cond)

const reverse = #(coll) =>
  toImmutable(coll).reverse()

const groupBy = #(coll f) => {
  coll = toImmutable(coll)
  coll.groupBy(f)
}

const concat = #(...args) => {
  if (isEmpty(args)) {
    Immutable.List([])
  }
  else {
    const [coll ...iterables] = map(args toImmutable)
    coll.concat(...iterables)
  }
}

const keys = #(coll) =>
  toImmutable(coll).keySeq()

const toSeq = #(coll) => {
  coll = toImmutable(coll)
  if (Immutable.isKeyed(coll)) {
    coll.entrySeq()
  }
  else {
    coll.toSeq()
  }
}

const fromPairs = #(kvPairs) =>
  Immutable.Map(kvPairs)

const indexOf = #(coll item) => {
  coll = toImmutable(coll)
  if (!coll.indexOf) {
    raise("Not an indexed collection")
  }
  coll.indexOf(item)
}

const pick = #(m ...keys) => {
  const keySet = Immutable.Set(keys)
  toImmutable(m).filter(#(v k) => keySet.has(k))
}

const omit = #(m ...keys) => {
  const keySet = Immutable.Set(keys)
  toImmutable(m).filterNot(#(v k) => keySet.has(k))
}

const get = #(coll key) =>
  toImmutable(coll).get(key)

const getIn = #(coll path defaultVal = undefined) =>
  toImmutable(coll).getIn(path defaultVal)

const set = #(coll key value) =>
  toImmutable(coll).set(key value)

const setIn = #(coll path value) =>
  toImmutable(coll).setIn(path value)

const update = #(coll key f) =>
  toImmutable(coll).update(key f)

const updateIn = #(coll path f) =>
  toImmutable(coll).updateIn(path f)

const isPromise = #(p) =>
  instanceof(p Promise)

defmacro cond = #(context block) => {
  const blockWrap = #(v) => {
    if (isBlock(v)) {
      dsl.block(...get(v "statements"))
    }
    else {
      dsl.block(v)
    }
  }
  const pairs = partition(get(block "statements") 2)
  dsl.ifList(...map(pairs #([conditional result] index) => {
    if (index == 0) {
      dsl.ifNode(conditional blockWrap(result))
    }
    elseif (isReference(conditional) && get(conditional "symbol") == "else$wlt") {
      dsl.elseNode(blockWrap(result))
    }
    else {
      dsl.elseIfNode(conditional blockWrap(result))
    }
  }))
}

defmacro chain = #(context block ...args) => {
  reduce(block.:statements #(result call) => {
    const newCall = cond {
      isValueSequence(call) && isFunctionCall(getIn(call [:values 1]))
      call

      isReference(call)
      dsl.valueSeq(call dsl.functionCall())

      else
      // FUTURE add support for macro context argument that will allow better error reporting
      // We want to indicate the location of the problem in the code like other compilation problems
      raise("Invalid arguments passed to chain")
    }
    result = cond { Immutable.List.isList(result) result else [result] }
    updateIn(newCall [:values 1 :args] #(v) => concat(result v))
  } toImmutable(args))
}

const isWhen = #(target) => isStringLiteral(target) && target.value == :when

const processWhens = #(target sequence [pair ...rest]) => {
  const condition = last(pair)

  const fun = dsl.func([target] condition)
  let newSeq = quote(filter(unquote(sequence) unquote(fun)))
  if (isEmpty(rest)) {
    newSeq
  }
  else {
    processWhens(target newSeq rest)
  }
}

const processPairs = #(block [pair ...rest]) => {
  const whenPairs = takeWhile(rest #([target]) => isWhen(target))
  const afterWhenPairs = dropWhile(rest #([target]) => isWhen(target))

  let [target sequence] = pair

  // In order to group together the if else it has to be wrapped in a block
  sequence = {
    if (isEmpty(whenPairs)) {
      sequence
    }
    else {
      processWhens(target sequence whenPairs)
    }
  }

  if (isEmpty(afterWhenPairs)) {
    const fun = dsl.func([target] block)
    quote(map(unquote(sequence) unquote(fun)))
  }
  else {
    const fun = dsl.func([target] processPairs(block afterWhenPairs))
    quote(flatMap(unquote(sequence) unquote(fun)))
  }
}

defmacro for = #(context block ...args) => {
  const pairs = partition(args 2)
  processPairs(block pairs)
}

// FUTURE equals (and should accept multiple arguments)

module.exports = jsObject(#{
  falsey
  truthy
  isNil
  raise
  jsObject
  jsArray
  prettyLog
  count
  doAll
  isEmpty
  and
  or
  identity
  isImmutable
  toImmutable
  map
  flatMap
  reduce
  filter
  range
  slice
  partition
  first
  last
  sort
  sortBy
  take
  drop
  dropLast
  reverse
  groupBy
  concat
  keys
  toSeq
  fromPairs
  indexOf
  pick
  omit
  get
  set
  setIn
  update
  getIn
  updateIn

  isPromise
  // macros
  macroexpandRaw
  macroexpand
  for
  cond
  chain
})
