# Willet Documentation

## Basics

Willet compiles to JavaScript and borrows many of its conventions and types.

### Blocks, Statements, and Expressions

Unlike JavaScript, Willet does not require commas or semicolons to define statements and separate expressions. Willet is _not_ whitespace sensitive like Python. The Willet syntax is well defined so its clear to the parser where statements start and end.  

```
console.log('This is Willet!')

const myFunction = #() => {
  const myList = [1 2 3]
  console.log('I\'m in a function')
  myList
}

myFunction()
```

Blocks in Willet is zero to many statements within a brace enclosed block. The last value in the block is returned.

```
const v1 = {}
const v2 = { 1 }
const v3 = {
  console.log('hello')
  2
}
const v4 = {
  const s = 7
  s + v3
}

v1 == null
v2 == 1
v3 == 2
v4 == 9
```

Blocks in Willet can be used in the following places to Willet:

* On their own to scope a set of statements.
* As the body of a function
* As a parameter to Macros

### Math and Infix Operations

Math and infix operations work the same way as in JavaScript. Parentheses to group expressions are written `#()`

```
1 + 1 / 2

// This is a parentheses wrapped expressions.
#(1 + 1) * 2
```

#### Equality

The equality operator `==` in Willet performs a strict equality check like the `===` operator in Javascript.

```
1 == 1 // true
1 == '1' // false
```

### Comments

```
// one line comment

/*
  mutiline
  comment
*/
```

### Variables

Willet uses `let` and `const` which have the same semantics as JavaScript.

```
  let modifiableVar = 5
  const readOnlyVar = 'Never changes'
```

## Data Structures and Types

### Basic Data Structures

These are all the same as JavaScript.

* Boolean: `true` and `false`
* `null`
* `undefined`
* Number
* BigInt
* _Regular Expressions_ - Future feature

### Strings

```
'Single quotes'
"And double quotes both work"

`Back ticks allow string interpolation ${1 + 1}
and can have multiple lines`
```

Symbol style strings like `:red` allow easy creation of simple strings that reference fields.

```
:red == 'red'
// true
```

### Lists

Lists are written using `[]` square brackets and create an [Immutable.js List](https://immutable-js.github.io/immutable-js/docs/#/List)

```
[1 2 3]
```

### Maps

Maps are similar to JavaScript Objects and create an [Immutable.js Map](https://immutable-js.github.io/immutable-js/docs/#/Map). A `#{` starts a map and a `}` closes it.

```
#{
  alpha: 'a value'
  foo: 5
}
```

### Sets

Sets are written using `#[]` and create an [Immutable.js Set](https://immutable-js.github.io/immutable-js/docs/#/Set).

```
#[1 2 3]
```

## Control Flow

### Truthyness

Before discussing control flow we need to discuss what is considered truthy and falsey.

The following values are considered falsey

* `false`
* `null`
* `undefined`

All other values are truthy. Unlike JavaScript these values are truthy.
* `0`
* `NaN`
* `""` Empty strings

### If Else

The if/elseif/else execute blocks if conditions are met

```
if (condition) {
  doSomething()
}
elseif (otherCondition) {
  doSomethingElse()
}
else {
  otherThing()
}
```

_Note: `elseif` is a single word_

The blocks within the commands all return the last statement of the block. The if/elseif/else command as a whole returns the result of the block that is executed.

The result of an if/else can be assigned to a variable or returned from a function. Note that parentheses wrapping the if or a block are required. This is a downside and potential flaw in the language. The if else structure parses initially as two separate statements. Later during semantic parsing it is combined into a separate expression.

```
const maximum = #(
  if (x > y) {
    x
  }
  else {
    y
  }
)
```

### Cond

Cond is an alternative to if else expressions that can result in terser code.

```
cond {
  condition
  doSomething()

  otherCondition
  doSomethingElse()

  else
  otherThing()
}
```

Here's the last if else example as a cond

```
const maximum = cond {
  x > y
    x
  else
    y
}
```


## Error Handling

### Try Catch Finally

Error handling is accomplished with a `try catch finally` expression. This works exactly the same as in JavaScript with the exception that the last expression of a try block is returned if no error is thrown and the last expression of the catch if an error is thrown.

Example of a function that returns true if an error is thrown and false otherwise.
```
const throwsError = #(fn) => {
  try {
    fn()
    false
  }
  catch (e) {
    true
  }
}
```

### Raise and Throw

Errors can be thrown with the `throw` operator just like JavaScript.

```
throw new Error('Failure message')
```

`raise` is a shortcut for throwing a new error with a specified message.

```
raise('Failure message')
```

## List Comprehensions

`for` is used for list comprehensions. It takes one or more sequences and converts it into a single lazy sequence of results.

```
for (x [1 2 3]
     y [:a :b]) {
  [x y]
}

// Returns
[
  [1 :a]
  [1 :b]
  [2 :a]
  [2 :b]
  [3 :a]
  [3 :b]
]
```

`for` can also take a `:when` plus a condition clause to limit results

```
const evenNums = for (x (range 0 1000)
     :when x % 2 == 0) {
 x
}

// evenNums is [0 2 4 6 8 10 ...]
```

TODO link to the standard library docs of use map.

## Functions

Functions in Willet create JavaScript arrow functions. The syntax is very similar.

```
const increment = #(v) => v + 1
```

### Implicit return

The last evaluated value in the function is returned. Willet has no `return` keyword.

```
const factorial = #(n) => {
  if (n == 0 || n == 1) {
    1
  }
  else {
    n * factorial(n - 1)
  }
}
```

### Calling functions

Functions are invoked just as in JavaScript with parentheses.

```
const increment = #(v) => v + 1

increment(1) // => 2
```

### Rest Parameters and Splat operator

The rest parameter syntax can collection any number of arguments.

```
const myFunc = #(p1 p2 ...others) => {
  // others is an array of the other arguments
}

myFunc(1 2 3 4 5)
// others will be a javascript array of [3, 4, 5]
```

The splat operator `...` allows expanding a sequence to pass into a function.

```
const array = [2 3 4]
myFunc(1 ...array 5)
// my func is passed 1, 2, 3, 4, 5 as arguments
```


TODO Macros

TODO Willet Standard library
