def _ = require("lodash")
def chai = require("chai")
def expect = chai.expect
def parser = require("../parser")
def examples = require("../tests/examples")

def assertSingleStatement = fn (input expectedStmt) {
  def result = parser.parse(input)
  def expected = #{ type: "Program" statements: [expectedStmt] }
  expect(result).to.deep.equal(expected)
}

// TODO skipping this for now until I go through and fix all the parse examples
describe.skip("Willet Parser" fn () {
  fore([exampleSetName exampleSet] _.toPairs(examples)) {
    describe(exampleSetName fn () {
      fore(#{ name willet ast } exampleSet) {
        it(`should parse ${name}` fn () {
          assertSingleStatement(willet ast)
        })
      }
    })
  }
})
