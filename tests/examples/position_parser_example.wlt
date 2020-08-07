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

1 * 2 + #(3 - 4)

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
