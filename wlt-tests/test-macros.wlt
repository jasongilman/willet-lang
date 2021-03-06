const chai = require("chai")
const chaiImmutable = require("chai-immutable")
chai.use(chaiImmutable)
const expect = chai.expect
const #{ dsl removePositions } = require("../lib/ast-helper")

// Contains another macro to test macros in other files.
const helper = require("./test-helper")

const dslEqual = #(actual expected) =>
  expect(removePositions(actual)).to.deep.equal(removePositions(Immutable.fromJS(expected.toJS())))

describe('quote' #() => {
  describe('simple values' #() => {
    it('should handle literals' #() => {
      dslEqual(quote(1) dsl.number(1))
      dslEqual(quote(:f) dsl.literal(:f))
    })
    it('should handle arrays' #() => {
      dslEqual(quote([1]) dsl.array(dsl.literal(1)))
    })
  })

  describe('more complex code' #() => {
    dslEqual(
      quote({
        if (true) { 5 }
      })
      dsl.block(
        dsl.ifList(
          dsl.ifNode(dsl.literal(true) dsl.block(
            dsl.literal(5)
          ))
        )
      )
    )
  })
})

describe('unquote' #() => {
  describe('simple values' #() => {
    it('should handle literals' #() => {
      expect(unquote(1)).to.deep.equal(1)
      expect(unquote(:f)).to.deep.equal(:f)
    })
    it('should handle arrays' #() => {
      expect(unquote([1])).to.deep.equal([1])
    })
    it('should handle references' #() => {
      const foo = 5
      expect(unquote(foo)).to.deep.equal(5)
    })
  })

  describe('more complex code' #() => {
    expect(
      unquote({
        if (true) { 5 }
      })
    ).to.deep.equal(5)
  })
})

defmacro parseWilletWrapper = #(context block) => {
  quote {
    const node = parseWillet(unquote(block))
    #{
      node
    }
  }
}

describe('macro calls in macros' #() => {
  it('should not invoke a macro within a quote block' #() => {
    const result = parseWilletWrapper {5 + 5}
    dslEqual(result.:node, dsl.block(
        dsl.infix(
          dsl.literal(5)
          '+'
          dsl.literal(5)
        )
      )
    )
  })
})

describe('run macro defined in another file' #() => {
  it('should work' #() => {
    expect(helper.macroInRequiredFile(1 1 1 1)).to.be.equal(4)
  })
})

defmacro localMacro = #(context block ...args) =>
  dsl.number(count(args))

describe('parseWillet' #() => {
  it('should handle simple values' #() => {
    dslEqual(parseWillet(1) #{ _type: 'NumberLiteral' pos: null value: 1 })
  })

  it('should expand core macros' #() => {
    const expected = #{
      _type: "Block"
      statements: [
        #{
          _type: "Def"
          defType: "const"
          target: #{
            _type: "Reference"
            symbol: "formR"
          }
          value: #{
            _type: "BooleanLiteral"
            value: true
          }
          annotation: null
        }
        #{
          _type: "IfList"
          items: [
            #{
              _type: "If"
              cond: #{
                _type: "UnaryExpression"
                operator: "!"
                target: #{
                  _type: "Reference"
                  symbol: "formR"
                }
              }
              block: #{
                _type: "Block"
                statements: [
                  #{
                    _type: "BooleanLiteral"
                    value: false
                  }
                ]
                solo: true
              }
            }
            #{
              _type: "Else"
              block: #{
                _type: "Block"
                statements: [
                  #{
                    _type: "Block"
                    statements: [
                      #{
                        _type: "Def"
                        defType: "const"
                        target: #{
                          _type: "Reference"
                          symbol: "formR"
                        }
                        value: #{
                          _type: "BooleanLiteral"
                          value: false
                        }
                        annotation: null
                      }
                      #{
                        _type: "IfList"
                        items: [
                          #{
                            _type: "If"
                            cond: #{
                              _type: "UnaryExpression"
                              operator: "!"
                              target: #{
                                _type: "Reference"
                                symbol: "formR"
                              }
                            }
                            block: #{
                              _type: "Block"
                              statements: [
                                #{
                                  _type: "BooleanLiteral"
                                  value: false
                                }
                              ]
                              solo: true
                            }
                          }
                          #{
                            _type: "Else"
                            block: #{
                              _type: "Block"
                              statements: [
                                #{
                                  _type: "BooleanLiteral"
                                  value: true
                                }
                              ]
                              solo: true
                            }
                          }
                        ]
                      }
                    ]
                    solo: true
                  }
                ]
                solo: true
              }
            }
          ]
        }
      ]
      solo: true
    }
    const expanded = parseWillet(and(true false))
    dslEqual(expanded expected)
  })

  it('should expand macros defined in local scope' #() => {
    dslEqual(parseWillet(localMacro(1 1 1)) #{ _type: 'NumberLiteral' pos: null value: 3 })
  })
})

defmacro captureConsoleLog = #(context block) => {
  quote {
    const oldLog = console.log
    const oldError = console.log
    let output = ''
    console.log = #(...args) => {
      output = `${output}\n${args.join(' ')}`
      null
    }
    console.error = console.log
    let result
    try {
      result = unquote(block)
    }
    finally {
      console.log = oldLog
      console.error = oldError
    }
    [output result]
  }
}

describe('macroexpand' #() => {
  it('should handle simple values' #() => {
    const [output] = captureConsoleLog {
      macroexpand(1)
    }
    expect(output.trim()).to.deep.equal('1')
  })

  it('should expand core macros' #() => {
    const expected = `
{
  const formR = true
  if (! formR) {
    false
  }else {
    {
      const formR = false
      if (! formR) {
        false
      }else {
        true
      }
    }
  }
}`.trim()
    const [expanded] = captureConsoleLog { macroexpand(and(true false)) }
    expect(expanded.trim()).to.deep.equal(expected)
  })

  it('should expand macros defined in local scope' #() => {
    const [expanded] = captureConsoleLog { macroexpand(localMacro(1 1 1)) }
    expect(expanded.trim()).to.deep.equal('3')
  })
})

describe('toJavaScript' #() => {
  it('should handle simple values' #() => {
    expect(toJavaScript(parseWillet(1))).to.deep.equal('1')
  })

  it('should expand core macros' #() => {
    const expected = `
(() => {
    const formR = true;
    return (() => {
        if (truthy(!truthy(formR))) {
            return false;
        } else {
            return (() => {
                const formR = false;
                return (() => {
                    if (truthy(!truthy(formR))) {
                        return false;
                    } else {
                        return true;
                    }
                    return null;
                })();
            })();
        }
        return null;
    })();
})()`.trim()
    expect(toJavaScript(parseWillet(and(true false)))).to.deep.equal(expected)
  })

  it('should expand macros defined in local scope' #() => {
    expect(toJavaScript(parseWillet(localMacro(1 1 1)))).to.deep.equal('3')
  })
})
