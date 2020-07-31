# Willet Documentation

## Basics

Willet compiles to JavaScript and borrows many of its conventions and types.

### Blocks, Statements, and Expressions

Unlike JavaScript, Willet does not require commas or semicolons to define statements and separate expressions. Willet is _not_ whitespace sensitive like Python. The Willet syntax is well defined so its clear to the parser where statements start and end.  

```javascript
console.log('This is Willet!')

const myFunction = #() => {
  const myList = [1 2 3]
  console.log('I\'m in a function')
  myList
}

myFunction()
```

Blocks in Willet is zero to many statements within a brace enclosed block. The last value in the block is returned.

```javascript
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

```javascript
1 + 1 / 2

// This is a parentheses wrapped expressions.
#(1 + 1) * 2
```

#### Equality

The equality operator `==` in Willet performs a strict equality check like the `===` operator in Javascript.

```javascript
1 == 1 // true
1 == '1' // false
```

### Comments

```javascript
// one line comment

/*
  mutiline
  comment
*/
```

### Variables

Willet uses `let` and `const` which have the same semantics as JavaScript.

```javascript
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

```javascript
'Single quotes'
"And double quotes both work"

`Back ticks allow string interpolation ${1 + 1}
and can have multiple lines`
```

Symbol style strings like `:red` allow easy creation of simple strings that reference fields.

```javascript
:red == 'red'
// true
```

### Lists

Lists are written using `[]` square brackets and create an [Immutable.js List](https://immutable-js.github.io/immutable-js/docs/#/List)

```javascript
[1 2 3]
```

### Maps

Maps are similar to JavaScript Objects and create an [Immutable.js Map](https://immutable-js.github.io/immutable-js/docs/#/Map). A `#{` starts a map and a `}` closes it.

```javascript
#{
  alpha: 'a value'
  foo: 5
}
```

### Sets

Sets are written using `#[]` and create an [Immutable.js Set](https://immutable-js.github.io/immutable-js/docs/#/Set).

```javascript
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

```javascript
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

```javascript
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

```javascript
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

```javascript
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

```javascript
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

```javascript
throw new Error('Failure message')
```

`raise` is a shortcut for throwing a new error with a specified message.

```javascript
raise('Failure message')
```

## List Comprehensions

`for` is used for list comprehensions. It takes one or more sequences and converts it into a single lazy sequence of results.

```javascript
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

```javascript
const evenNums = for (x (range 0 1000)
     :when x % 2 == 0) {
 x
}

// evenNums is [0 2 4 6 8 10 ...]
```

TODO link to the standard library docs of use map.

## Functions

Functions in Willet create JavaScript arrow functions. The syntax is very similar.

```javascript
const increment = #(v) => v + 1
```

### Implicit return

The last evaluated value in the function is returned. Willet has no `return` keyword.

```javascript
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

```javascript
const increment = #(v) => v + 1

increment(1) // => 2
```

### Rest Parameters and Splat operator

The rest parameter syntax can collection any number of arguments.

```javascript
const myFunc = #(p1 p2 ...others) => {
  // others is an array of the other arguments
}

myFunc(1 2 3 4 5)
// others will be a javascript array of [3, 4, 5]
```

The splat operator `...` allows expanding a sequence to pass into a function.

```javascript
const array = [2 3 4]
myFunc(1 ...array 5)
// my func is passed 1, 2, 3, 4, 5 as arguments
```

## Macros

Macros are code that run at compile time to create new code. It's like extending the Willet compiler to support new kinds of code forms. Several of the existing parts of Willet are implemented as macros like `chain` and `for`.

### A Basic Macro

This defines a macro that will run some code conditionally if a condition is not true. It's basically the opposite of `if`

```javascript
defmacro unless = #(context block condition) => {
  quote {
    if (!unquote(condition)) {
      unquote(block)
    }
  }
}
```

Using the macro:

```javascript
unless (false) {
  console.log('running')
}
```

Macros are passed 2 or more arguments:

* A compilation context - This is mostly not needed except in cases where the macro is calling back into Willet compilation code.
* block - A Block if the macro invocation was passed one.
* arguments - Any additional arguments are the arguments passed to the macro call

### Macros are passed AST and produce AST

Macros are run during the compilation process so they don't receive arguments in the form of Abstract Syntax Tree (AST) Willet nodes. The AST Nodes are datastructures that represent Willet code.

Consider the following macro and call:

```javascript
defmacro doesNothing = #(context block theArg) => {
  console.log(`theArg: ${JSON.stringify(theArg null 2)}`)
  theArg
}

doesNothing(true)
```

What is the output when we compile this code and run it:

Output During Compilation:

```JSON
theArg: {
  "_type": "BooleanLiteral",
  "value": true
}
```

**Note: AST are Immutable JS datastructures but are printed in the docs as JSON**

Compiled JavaScript:

```javascript
let doesNothing = (() => {
  // Compiled doesNothing code here
})();
true; // <--- the output of the doesNothing macro is here
```

During compilation the `doesNothing` macro was passed the AST node representation of the literal value `true`. It printed that node and then returned it. The Willet compiler replaced the call `doesNothing(true)` with the resulting code `true`. The `doesNothing` macro code is also present in the output code but is not invoked at run time.

### Quote and Unquote

The AST nodes passed into a macro can be directly manipulated or created but there are two helper functions for creating AST nodes with desired values.

#### Quote

Quote is a macro itself that will produce the AST that it is passed. It's like a templating system for creating Willet code.

Running quote at runtime

```
quote(1 + 1)
```

Produces output like this:

```JSON
{
  "_type": "InfixExpression",
  "operator": "+",
  "left": {
    "_type": "NumberLiteral",
    "value": 1
  },
  "right": {
    "_type": "NumberLiteral",
    "value": 1
  }
}
```

#### Unquote

Unquote is used to punch a hole in the quoted code to allow dynamic replacement of variables and values defined outside the quoted code.

Unquote is used here to reference the value argument in this macro.

```javascript
defmacro multipleByPi = #(context block value) => {
  quote(unquote(value) * Math.PI)
}
```

### Defining and using macros

* Macros are defined with `defmacro` and must be defined at the top level of a module.
* Macros can be exported from a module and used in another file.

### MacroExpanders

There are two macros built into Willet that help in debugging macros. They expand calls to a macro and return the new AST.

* `parseWillet` - Returns the raw AST of an expanded macro call.
* `macroexpand` - Returns the expanded Willet code of a macro call.

`parseWillet` is good when you want to see the literal AST nodes for detailed debugging. `macroexpand` produced easier to read Willet code.


```javascript
parseWillet(
  unless (false) {
    console.log('running')
  }
)
```
```JSON
{
  "_type": "Block",
  "statements": [
    {
      "_type": "IfList",
      "items": [
        {
          "_type": "If",
          "cond": {
            "_type": "UnaryExpression",
            "operator": "!",
            "target": {
              "_type": "BooleanLiteral",
              "value": false
            }
          },
          "block": {
            "_type": "Block",
            "...": "..."
          }
        }
      ]
    }
  ]
}
```

```javascript
macroexpand(
  unless (false) {
    console.log('running')
  }
)

// Produces
{
  if (! false) {
    {
      console.log("running")
    }
  }
}
```


TODO Willet Standard library
