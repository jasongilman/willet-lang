"//before1"
"before2/* */"
"after"
`string ${true} interpolation
can be multiplelines.
Can have ${`Another interpolation ${5 + 7}.`}
`
@{
  someAnnotation: true
}
1
2.3
"4"
true
false
#{}
[]
#[]
#()
#{
  foo: [
    #[
      #(
        "bar"
      )
    ]
  ]
  chew: #{}
}
1 * 2 + 3 - 4 / 5 % 6 && ! #(
  7 || 8
)
throw new Thing()
await thing()
@{
  foo: "bar"
}
foo.bar.[0]() {}
foo.:bar.:alpha
foo()
foo() {}
foo(
  1 2 ...rest
) {
  bar
  null
  undefined
}