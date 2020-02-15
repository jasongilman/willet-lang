const Immutable = require("immutable")
// Path to ast-helper works from lib or from compiled dist
const astHelper = require("../lib/ast-helper")
const #{ dsl } = astHelper

const isImmutable = Immutable.isImmutable

const toImmutable = #(v) => {
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

const raise = #(error) => {
  throw(new(Error(error)))
}

const falsey = #(v) =>
  staticjs("v === false || v === null || v === unconstined")


const truthy = #(v) =>
  staticjs("v !== false && v !== null && v !== unconstined")


const isNil = #(v) =>
  staticjs("v === null || v === unconstined")


// Allows creating a regular javascript object.
defmacro jsObject = #(block obj) => {
  if (block) {
    raise("jsObject macro does not take a block")
  }
  if (obj.get("type") != "MapLiteral") {
    raise("jsObject macro must contain a map literal")
  }
  obj.set("js" true)
}

// Allows creating a regular javascript array from a wilarray.
// Must be passed
defmacro jsArray = #(block list) => {
  if (block) {
    raise("jsArray macro does not take a block")
  }
  if (list.get("type") != "ArrayLiteral") {
    raise("jsArray macro must contain a array literal")
  }
  list.set("js" true)
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

defmacro and = #(block ...args) => {
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

    quote() {
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

defmacro or = #(block ...args) => {
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

const identity = #(v) => v

const map = #(coll f) =>
  // TODO change this to check if it's keyed and call entrySeq
  toImmutable(coll).map(f)


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
  // TODO change this to check if it's keyed and call entrySeq
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
  if (coll.first) {
    coll.first()
  }
  else {
    coll.[0]
  }
}

const last = #(coll) => {
  if (coll.last) {
    coll.last()
  }
  else {
    coll.[count(coll) - 1]
  }
}

const drop = #(coll n = 1) =>
  slice(coll n)


const dropLast = #(coll n = 1) =>
  slice(coll 0 count(coll) - n)


const groupBy = #(coll f) => {
  coll = toImmutable(coll)
  coll.groupBy(f)
}

const concat = #(...args) => {
  if (isEmpty(args)) {
    Immutable.List([])
  }
  else {
    const [coll ...iterables] = args
    coll = toImmutable(coll)
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


const get = #(coll key) =>
  toImmutable(coll).get(key)


const getIn = #(coll path constaultVal = unconstined) =>
  toImmutable(coll).getIn(path constaultVal)


const set = #(coll key) =>
  toImmutable(coll).set(key)


const setIn = #(coll path constaultVal = unconstined) =>
  toImmutable(coll).setIn(path constaultVal)


const update = #(coll key f) =>
  toImmutable(coll).update(key f)


const updateIn = #(coll path f) =>
  toImmutable(coll).updateIn(path f)


const isPromise = #(p) =>
  instanceof(p Promise)


defmacro cond = #(block) => {
  const blockWrap = #(v) => {
    if (v.type == "Block") {
      dsl.block(...get(v "statements"))
    }
    else {
      dsl.block(v)
    }
  }
  const pairs = partition(get(block "statements") 2)
  dsl.ifList(...map(pairs, #([conditional result] index) => {
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

defmacro chain = #(block ...args) => {
  const calls = get(block "statements")
  reduce(calls #(result call) => {
    const newCall = cond {
      get(call "type") == "ValueSequence" && getIn(call ["values" 1 "type"]) == "FunctionCall"
      call

      get(call "type") == "Reference"
      dsl.valueSeq(call dsl.functionCall())

      else
      // TODO add support for macro context argument that will allow better error reporting
      raise("Invalid arguments passed to chain")
    }
    result = cond { Immutable.List.isList(result) result else [result] }

    updateIn(newCall ["values" 1 "args"] #(v) => concat(result v))
  } args)
}

const processPairs = #(block [pair ...rest]) => {
  const [target collection] = pair
  if (isEmpty(rest)) {
    const fun = dsl.func([target] block)
    quote(map(unquote(collection) unquote(fun)))
  }
  else {
    const fun = dsl.func([target] [processPairs(block rest)])
    quote(map(unquote(collection) unquote(fun)))
  }
}

// FUTURE support when, etc
defmacro fore = #(block ...args) => {
  const pairs = partition(args 2)
  processPairs(block pairs)
}

// TODO equals (and should accept multiple arguments)

module.exports = jsObject(#{
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
  fore
  cond
  chain
})
