

"//before1"// A comment
// A comment

'before2/* */'/* a mutiline

comment */ :after

`string ${true} interpolation
can be multiplelines.
Can have ${ `Another interpolation ${5 + 7}.`}
`
`Escaped chars\\n in \tstring interp\n`
@someAnnotation
1
2.3
"4"
true
false
#{} //empty map
[] // empty array
#[] // empty set
#() // empty list

#{
  foo: [
    #[
      #("bar")
    ]
  ]
  chew: #{}
  'bar': :bar
}

1 * 2 + 3 - 4 / 5 % 6 && !#(7 || 8)

$.foo // jquery style vars can work

throw new Thing()
await thing()

@{ foo: :bar }
foo.bar.[0](){}

foo.:bar.:alpha

foo()
foo {}
foo(1 2 ...rest) {
  bar
  null
  undefined
}
