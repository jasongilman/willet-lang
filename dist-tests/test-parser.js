let _ = require("lodash");
let chai = require("chai");
let expect = chai.expect;
let parser = require("../parser");
let examples = require("../tests/examples");
let assertSingleStatement = (input, expectedStmt) => {
  let result = parser.parse(input);
  let expected = {
    type: "Program",
    statements: [expectedStmt]
  };
  return expect(result).to.deep.equal(expected);
};
describe("Willet Parser", () => {
});