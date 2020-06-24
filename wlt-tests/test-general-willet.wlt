const chai = require("chai")
const expect = chai.expect

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

// TODO chain macro
// TODO add try catch
// TODO add new and throw
