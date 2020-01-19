def chai = require("chai")
def expect = chai.expect


def incrementer = fn(v) { v + 1 }

describe("Function invocation" fn () {
  it("should allow calling function" fn () {
    expect(2).to.be.equal(incrementer(1))
  })
})
