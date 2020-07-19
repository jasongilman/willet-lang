const fs = require('fs')
const chai = require("chai")
const chaiImmutable = require("chai-immutable")
chai.use(chaiImmutable)
const expect = chai.expect

const parser = require('../lib/chevrotain-parser')
const semanticParser = require('../lib/semantic-parser');
const willetCompiler = require('../lib/willet-compiler')
const keywordReplacer = require('../lib/keyword-replacer');

const fullExampleCode = fs.readFileSync(
  `${__dirname}/../tests/examples/full_parser_example.wlt`
).toString().trim()

const expectedCompiledFullExampleCode = fs.readFileSync(
  `${__dirname}/../wlt-tests/recompiled_examples/compiled_full_parser_example.wlt`
).toString().trim()

const fullSemanticExampleCode = fs.readFileSync(
  `${__dirname}/../tests/examples/full_semantic_parser_example.wlt`
).toString().trim()

const expectedCompiledFullSemanticExampleCode = fs.readFileSync(
  `${__dirname}/../wlt-tests/recompiled_examples/compiled_full_semantic_parser_example.wlt`
).toString().trim()

describe('willet-compiler' #() => {
  it('should be able to convert full example code back into willet' #() => {
    const parsed = parser.parse(fullExampleCode)
    const compiled = willetCompiler.compile(parsed)
    expect(compiled).to.be.equal(expectedCompiledFullExampleCode);
  })

  it('should be able to reparse and compile back to the same exact code' #() => {
    const parsed = parser.parse(expectedCompiledFullExampleCode)
    const compiled = willetCompiler.compile(parsed)
    expect(compiled).to.be.equal(expectedCompiledFullExampleCode);
  })

  it('should be able to convert full semantic example code back into willet' #() => {
    let ast = parser.parse(fullSemanticExampleCode)
    ast = keywordReplacer.replaceJsKeywords(ast);
    ast = semanticParser.parse(ast);
    const compiled = willetCompiler.compile(ast)
    expect(compiled).to.be.equal(expectedCompiledFullSemanticExampleCode);
  })

  it('should be able to reparse and compile back to the same exact code with semantic example' #() => {
    let ast = parser.parse(expectedCompiledFullSemanticExampleCode)
    ast = keywordReplacer.replaceJsKeywords(ast);
    ast = semanticParser.parse(ast);
    const compiled = willetCompiler.compile(ast)
    expect(compiled).to.be.equal(expectedCompiledFullSemanticExampleCode);
  })
})
