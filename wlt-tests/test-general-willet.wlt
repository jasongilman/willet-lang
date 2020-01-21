def chai = require("chai")
def expect = chai.expect


def incrementer = fn(v) { v + 1 }
def asyncIncrementer = afn(v) { v + 1 }

def complexAsync = afn (v) {
  if (v < 1) {
    asyncIncrementer(await(asyncIncrementer(v)))
  }
  else {
    asyncIncrementer(v)
  }
}


describe("Function invocation" fn () {
  it("should allow calling a function" fn () {
    expect(incrementer(1)).to.be.equal(2)
  })

  it("should allow calling an async function" afn () {
    expect(await(asyncIncrementer(1))).to.be.equal(2)
  })

  it("should allow calling an complex async function" afn () {
    let v = isPromise(complexAsync(1));
    expect(v).to.be.true
    expect(await(complexAsync(1))).to.be.equal(2)
    expect(await(complexAsync(-2))).to.be.equal(0)
  })

})

// TODO add try catch
