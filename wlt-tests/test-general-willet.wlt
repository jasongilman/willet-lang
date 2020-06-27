const chai = require("chai")
const chaiImmutable = require("chai-immutable")
chai.use(chaiImmutable)
const expect = chai.expect
// Requiring willet code to make sure that works
const helper = require("./test-helper")
// FUTURE add another require to make sure more than one works


const incrementer = #(v) => v + 1
const asyncIncrementer = @async #(v) => v + 1

const complexAsync = @async #(v) => {
  if (v < 1) {
    asyncIncrementer(await asyncIncrementer(v))
  }
  else {
    asyncIncrementer(v)
  }
}

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
  });
})

describe("And Or macros", #() => {
  let called = 0
  const call = #(v) => {
    called = called + 1
    v
  }
  it("should correctly handle OR", @async #() => {
    called = 0;
    const result = or(call(false) call(false) call(true) call(true))
    expect(result).to.be.equal(true)
    expect(called).to.be.equal(3)
  });

  it("should correctly handle AND", @async #() => {
    called = 0;
    const result = and(call(true) call(false) call(true) call(true))
    expect(result).to.be.equal(false)
    expect(called).to.be.equal(2)
  });
});

describe("for macro", #() => {

  it("should handle simplest case", @async #() => {
    const result = for(i range(0 3)) {
      i
    }
    expect(result).to.be.equal([0 1 2])
  });

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
  });

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
  });

  // TODO async bug is present here if @async is added
  it("should support :when", #() => {
    const result = for(i range(0 5)
                       :when i % 2 == 0) {
      i
    }
    expect(result).to.be.equal([0 2 4])
  });

  it("should support multiple :whens", #() => {
    const result = for(i range(0 10)
                       :when i % 2 == 0
                       :when i > 0 && i < 8) {
      i
    }
    expect(result).to.be.equal([2 4 6])
  });

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
  });

});

// FUTURE test recursive functions
// FUTURE chain macro
// FUTURE add try catch
// FUTURE add new and throw
