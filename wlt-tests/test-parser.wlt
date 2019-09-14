def _ = require("lodash")
def chai = require("chai")
def expect = chai.expect
def parser = require("../parser")
def examples = require("../tests/examples")

def assertSingleStatement = (input expectedStmt) => {
  def result = parser.parse(input)
  def expected = #{ type: "Program" statements: [expectedStmt] }
  expect(result).to.deep.equal(expected)
}

describe("Willet Parser" () => {
  for([exampleSetName exampleSet] _.toPairs(examples)) {
  //   describe(exampleSetName () => {
  //     for({ name willet ast } exampleSet) {
  //       it(`should parse ${name}` () => {
  //         assertSingleStatement(willet ast)
  //       })
  //     }
  //   })
  }
})

word = "Jason"

defmacro helloer = (name) => quote(
  if (true) {
    console.log("hello" unquote(name))
  }
)

helloer(word)

helloer("foo")


defmacro logger = (value) => quote(
  console.log("This is my value" unquote(value))
)

defmacro beforeAndAfter = (block) => quote(){
  logger("before")
  unquote(block)
  logger("after")
}

def x

beforeAndAfter() {
  x = 5
}
x

e
