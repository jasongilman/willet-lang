const logger = #(
  ...parts
) => {
  console.log(
    parts
  )
}
@{
  docs: "Some kind of documentation"
}
const multilineFunction = @async #(
  alpha beta cappa = 45 + 7
) => {
  logger(
    alpha beta
  )
  if (cappa > 45) {
    alpha
  }elseif (cappa < 45) {
    beta
  }else {
    cappa
  }
}
const singleResponseFn = #(
  v
) => {
  v
}
defmacro myMacro = #(
  context blok argv
) => {
  [
    blok argv
  ]
}
let #{
  foo: bar
  alpha: alpha
} = #{}
let [
  a b ...c
] = #{}
let myFun = #(
  #{
    a: a
    b: b
  } [
    c d
  ]
) => {
  null
}
try {
  foo()
}
catch(err) {
  logger(
    err
  )
}
finally {
  bar()
}
try {
  foo()
}
finally {
  bar()
}
middle
#{
  _type: "InfixExpression"
  operator: "+"
  left: myFun
  right: #{
    _type: "NumberLiteral"
    value: 1
    pos: #{
      startOffset: 681
      endOffset: 681
      startLine: 54
      endLine: 54
      startColumn: 24
      endColumn: 24
    }
  }
  pos: #{
    startOffset: 664
    startLine: 54
    startColumn: 7
    endOffset: 681
    endLine: 54
    endColumn: 24
  }
}
#{
  _type: "InfixExpression"
  operator: "+"
  left: #{
    _type: "ValueSequence"
    values: [
      myFun #{
        _type: "GetProperty"
        attrib: "val"
        pos: #{
          startOffset: 704
          startLine: 55
          startColumn: 21
          endOffset: 707
          endLine: 55
          endColumn: 24
        }
      }
    ]
    pos: null
  }
  right: #{
    _type: "NumberLiteral"
    value: 1
    pos: #{
      startOffset: 711
      endOffset: 711
      startLine: 55
      endLine: 55
      startColumn: 28
      endColumn: 28
    }
  }
  pos: #{
    startOffset: 690
    startLine: 55
    startColumn: 7
    endOffset: 711
    endLine: 55
    endColumn: 28
  }
}.foo
try {
  foo()
}
catch(err) {
  logger(
    err
  )
}
after
foo(
  if (true) {
    1
  }else {
    0
  } try {
    2
  }
  catch(e) {
    3
  }
)
