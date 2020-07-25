const chai = require("chai")
const chaiImmutable = require("chai-immutable")
chai.use(chaiImmutable)
const expect = chai.expect
const #{ dsl } = require("../lib/ast-helper")

// Requiring willet code in test-helper to make sure that works
const helper = require("./test-helper")
// FUTURE add another require to make sure more than one works

const adder = #(a b) => a + b
const subtractor = #(a b) => a - b
const incrementer = #(v) => v + 1
const asyncIncrementer = @async #(v) => v + 1

const complexAsync = @async #(v) => {
  if (v < 1) {
    asyncIncrementer(await asyncIncrementer(v))
  }
  elseif ( v > 1000 ){
    throw new Error('Big v')
  }
  else {
    asyncIncrementer(v)
  }
}

describe('Promise functions' #() => {
  it('should be able to manipulate promises and catch error' #(done) => {
    const p = complexAsync(1001)
    p.then(#() => {
      done(new Error('Should have thrown an error'))
    })
    .catch(#() => {
      done()
    })
    null
  })
})

describe('truthy and falsey' #() => {
  const falseyValues = [
    null
    undefined
    false
  ]
  const truthyValues = [
    1
    0
    ""
    "something"
    true
    NaN
    jsArray([])
  ]

  doAll(for(v falseyValues) {
    it(`${v} should be falsey` #() => {
      expect(falsey(v)).to.be.true
    })
    it(`${v} should not be truthy` #() => {
      expect(truthy(v)).to.be.false
    })
  })

  doAll(for(v truthyValues) {
    it(`${v} should not be falsey` #() => {
      expect(falsey(v)).to.be.false
    })
    it(`${v} should be truthy` #() => {
      expect(truthy(v)).to.be.true
    })
  })
})

describe("Strings with special characters", #() => {
  it("should be equal with different quotes",#() => {
    expect("foo").to.be.equal('foo')
  })
  it("should be handle double quotes inside strings",#() => {
    expect("f\"oo\"").to.be.equal('f"oo"')
  })
  it("should be handle escaped double quotes inside single quote strings",#() => {
    expect("f\"oo\"").to.be.equal('f\"oo\"')
  })
  it("should be handle single quotes inside strings",#() => {
    expect("f'oo'").to.be.equal('f\'oo\'')
  })
  it("should be handle escaped single quotes inside double quote strings",#() => {
    expect("f\'oo\'").to.be.equal('f\'oo\'')
  })
  it("should be handle escaped slashes inside strings",#() => {
    expect("f\\oo\\").to.be.equal('f\\oo\\')
  })
  it("should be handle all combinations",#() => {
    const double = "\nNewline \\ \"other \" 'foo'"
    const single = '\nNewline \\ "other \" \'foo\''
    expect(double).to.be.equal(single)
  })

})

describe("Immutable property lookup", #() => {
  const obj = #{ alpha: 5 bar: 6 }
  it("should allow retrieving a property that exists", @async #() => {
    expect(obj.:alpha).to.be.equal(5)
  })
  it("should return undefined for a property that doesn't exist", @async #() => {
    expect(obj.:foo).to.be.equal(undefined)
  })
})

describe('immutable conversion' #() => {
  const immutableValue = #{
    a: #{ b: 5}
    c: [ 1 2 #{}]
    d: #[:set 2]
  }
  const mutableValue = toJS(immutableValue)
  const reimmutable = toImmutable(mutableValue)

  describe('isImmutable' #() => {
    it('should be able to detect immutable values' #() => {
      expect(isImmutable(immutableValue)).to.be.true
    })
    it('should be able to detect mutable values' #() => {
      expect(isImmutable(mutableValue)).to.be.false
    })
  })

  describe('toJS' #() => {
    it('should deeply convert to mutable values' #() => {
      expect(isImmutable(mutableValue)).to.be.false
      expect(isImmutable(mutableValue.a)).to.be.false
      expect(isImmutable(mutableValue.c)).to.be.false
      expect(isImmutable(mutableValue.d)).to.be.false
    })
  })

  describe('toImmutable' #() => {
    it('should deeply convert to immutable values' #() => {
      expect(isImmutable(reimmutable)).to.be.true
      expect(isImmutable(reimmutable.:a)).to.be.true
      expect(isImmutable(reimmutable.:c)).to.be.true
      expect(isImmutable(reimmutable.:d)).to.be.true
    })
  })
})

describe("Function invocation" #() => {
  it("should allow calling a function" #() => {
    expect(incrementer(1)).to.be.equal(2)
  })

  it("should allow calling an async function" @async #() => {
    expect(await asyncIncrementer(1)).to.be.equal(2)
  })

  it("should allow calling an complex async function" @async #()=>{
    let v = isPromise(complexAsync(1))
    expect(v).to.be.true
    expect(await complexAsync(1)).to.be.equal(2)
    expect(await complexAsync(-2)).to.be.equal(0)
  })

  it("should allow calling a function in a willet required module", @async #() => {
    expect(helper.increment(1)).to.be.equal(2)
  })
})

describe("And Or macros", #() => {
  let called = 0
  const call = #(v) => {
    called = called + 1
    v
  }
  it("should correctly handle OR", @async #() => {
    called = 0
    const result = or(call(false) call(false) call(true) call(true))
    expect(result).to.be.equal(true)
    expect(called).to.be.equal(3)
  })

  it("should correctly handle AND", @async #() => {
    called = 0
    const result = and(call(true) call(false) call(true) call(true))
    expect(result).to.be.equal(false)
    expect(called).to.be.equal(2)
  })
})

describe("for macro", #() => {
  it("should handle simplest case", @async #() => {
    const result = for(i range(0 3)) {
      i
    }
    expect(result).to.be.equal([0 1 2])
  })

  it("should handle multiple levels of iteration", @async #() => {
    const result = for(i range(0 3)
         j [:a :b :c]) {
      [i j]
    }
    expect(result).to.be.equal([
      [0 :a]
      [0 :b]
      [0 :c]
      [1 :a]
      [1 :b]
      [1 :c]
      [2 :a]
      [2 :b]
      [2 :c]
    ])
  })

  it("should make earlier declared vars available for subsequent steps", @async #() => {
    const result = for(i range(0 3)
         j [i i + 1]) {
      [i j]
    }
    expect(result).to.be.equal([
      [0 0]
      [0 1]
      [1 1]
      [1 2]
      [2 2]
      [2 3]
    ])
  })

  it("should support :when", @async #() => {
    const result = for(i range(0 5)
                       :when i % 2 == 0) {
      i
    }
    expect(result).to.be.equal([0 2 4])
  })

  it("should support multiple :whens", #() => {
    const result = for(i range(0 10)
                       :when i % 2 == 0
                       :when i > 0 && i < 8) {
      i
    }
    expect(result).to.be.equal([2 4 6])
  })

  it("should support all features at once", #() => {
    const result = for(i range(0 3)
                       :when i > 0
                       j [:a :b :c]) {
      [i j]
    }
    expect(result).to.be.equal([
      [1 :a]
      [1 :b]
      [1 :c]
      [2 :a]
      [2 :b]
      [2 :c]
    ])
  })
})

describe('chain macro' #() => {
  it('should handle no calls to chain' #() => {
    expect(chain(5) {}).to.be.equal(5)
  })
  it('should handle a call with no parentheses' #() => {
    expect(chain(5) {
      incrementer
    }).to.be.equal(6)
  })
  it('should handle a call with parentheses and no args' #() => {
    expect(chain(5) {
      incrementer()
    }).to.be.equal(6)
  })
  it('should handle a call with args' #() => {
    expect(chain(5) {
      adder(6)
    }).to.be.equal(11)
  })
  it('should handle a call and place args in correct position' #() => {
    expect(chain(5) {
      subtractor(6)
    }).to.be.equal(-1)
  })
  it('should chain multiple calls' #() => {
    expect(chain(20) {
      incrementer
      subtractor(6)
      incrementer
      adder(3)
    }).to.be.equal(19)
  })
})

describe('quicksort example from README' #() => {
  const quicksort = #([pivot ...others]) => {
    if (pivot) {
      concat(
        quicksort(filter(others #(v) => pivot >= v ))
        [pivot]
        quicksort(filter(others #(v) => pivot < v ))
      )
    }
  }

  it('should sort' #() => {
    expect(quicksort([3 2 4 9 0 8 7])).to.be.equal([0 2 3 4 7 8 9])
  })
})
// FUTURE add try catch
// FUTURE add new and throw
