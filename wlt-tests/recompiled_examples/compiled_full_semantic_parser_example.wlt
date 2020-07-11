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
middle
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
