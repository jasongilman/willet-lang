const logger = #(...parts) => {
  console.log(parts)
}

@{ docs: "Some kind of documentation"}
const multilineFunction = @async #(alpha beta cappa = 45 + 7) => {
  logger(alpha beta)

  if (cappa > 45) {
    alpha
  }
  elseif (cappa < 45) {
    beta
  }
  else {
    cappa
  }
}

const singleResponseFn = #(v) => v

defmacro myMacro = #(context blok argv) => {
  [blok argv]
}

// map destructuring
let #{ foo: bar alpha } = #{}

// array destructuring
let [ a b ...c] = #{}

// function arg destructuring
let myFun = #(#{ a b } [c d]) => null

try {
  foo()
}
catch (err) {
  logger(err)
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

quote(unquote(myFun) + 1)
quote(unquote(myFun).val + 1).foo

try {
  foo()
}
catch (err) {
  logger(err)
}

after

foo(
  if (true) { 1 } else { 0 }
  try { 2 } catch(e) { 3 }
)
