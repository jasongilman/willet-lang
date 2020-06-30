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

### Math and Infix Operations

Math and infix operations work the same way as in JavaScript. Parentheses to group expressions are written `#()`

```
1 + 1 / 2

// This is a parentheses wrapped expressions.
#(1 + 1) * 2
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

The following values are considered truthy

* `true`
* `0` or any other Number
* Any other object or value.

The following values are considered falsey

* `false`
* `null`
* `undefined`

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

The result of an if/else can be assigned to a variable or returned from a function.
```
const maximum = if (x > y) {
  x
}
else {
  y
}
```


TODOs

* Functions
  - no return statement needed
* Blocks
