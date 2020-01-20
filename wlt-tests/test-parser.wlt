def chai = require("chai")
def expect = chai.expect
def parser = require("../parser")
def examples = require("../tests/examples")

def assertSingleStatement = fn (input expectedStmts) {
  if (!isArray(expectedStmts)) {
    let expectedStmts = [expectedStmts]
  }
  def result = parser.parse(input)
  def expected = #{ type: "Program" statements: expectedStmts }
  expect(result).to.deep.equal(expected)
}

describe("Willet Parser" fn () {
  fore([exampleSetName exampleSet] toPairs(examples)) {
    describe(exampleSetName fn () {
      fore(#{ name willet ast } exampleSet) {
       // TODO this if should be handled by fore
        if (ast) {
          it(`should parse ${name}` fn () {
            assertSingleStatement(willet ast)
          })
        }
      }
    })
  }
})
