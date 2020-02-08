const chai = require("chai")
const expect = chai.expect
const parser = require("../parser")
const examples = require("../tests/examples")

const assertSingleStatement = #(input expectedStmts) => {
  if (!isArray(expectedStmts)) {
    expectedStmts = [expectedStmts]
  }
  const result = parser.parse(input)
  const expected = #{ type: "Program" statements: expectedStmts }
  expect(result).to.deep.equal(expected)
}

describe("Willet Parser" #() => {
  fore([exampleSetName exampleSet] toPairs(examples)) {
    describe(exampleSetName () => {
      fore(#{ name willet ast } exampleSet) {
       // TODO this if should be handled by fore
        if (ast) {
          it(`should parse ${name}` () => {
            assertSingleStatement(willet ast)
          })
        }
      }
    })
  }
})
