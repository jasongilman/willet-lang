# Willet

<b>The Willet Programming Language</b>

Willet is an experimental functional programming language that compiles to JavaScript. Willet is heavily inspired by Clojure and tries to bridge the gap between JavaScript and Lisp without going all the way to a full Lisp syntax. Willet provides easy use persistent immutable data structures, a macro system, and a full featured standard library.

## Install and Use

```
npm install willet
echo 'console.log("Hello Willet!")' > index.wlt
willet-compile index.wlt .
node index.js
```

## Features

* A fast and _extensible*_ compiler written in JavaScript
* Embraces JavaScript as a platform and leverages modern JS features
  * Async/await
  * Destructuring assignment, Rest and Spread
  * First class functions with default values
  * Easy integration with existing JavaScript code or libraries
  * Avoids some JS downsides such as the overly broad definition of false.
    * In Willet "false" is only literal `false`, `null`, and `undefined`
* Persistent immutable data structures natively supported by language
  * Powered by [Immutable](https://immutable-js.github.io/immutable-js/)
  * Literal syntax for maps, sets, and lists
  * Works with standard library functions
  * _Equality by value*_
* Macro System allowing language level extensions
  * Helpful Built in macros
    * Chaining expressions - `chain`
    * Switching style - `cond`
    * List comprehensions - `for`
  * Major language features are written as macros
    * `if` and `try catch`
* Standard Library with full set of functions/macros
  * Map, reduce, filter
  * _Data structure walking_*
  * Get, set, update deeply nested structures.  
  * Partition, slice, and group data
  * And more

(_* future feature_)

## Why Willet?

Modern JavaScript has a lot of great things like first class functions, promises and async/await, destructuring and a huge, well supported ecosystem. But its still got oddities from its past and is missing features that other modern functional programming languages have like macros and built-in immutable types.

_**Willet is an experiment.**_

If we start with JavaScript, its syntax, features, runtime, and libraries, and push it towards a Clojure-like Lisp how far do we have to go before we can get the same benefits? Can we get the same benefits of a homoiconic language and macros without going all the way to a Lisp syntax?

Other languages have done this like Elixir and there are other well supported languages that have these features in a JavaScript runtime such as ClojureScript. Willet is a chance to learn these things first hand and have fun building something.

## What does Willet Look Like?

```
const quicksort = #([pivot ...others]) => {
  if (pivot) {
    concat(
      quicksort(filter(others #(v) => pivot >= v ))
      [pivot]
      quicksort(filter(others #(v) => pivot < v ))
    )
  }
}
```

Things to note:

* No commas or semicolons needed.
  - Optional for readability or to remove ambiguity in certain situations.
  * No return statement necessary. Blocks always return the last result.
* `if` is a macro.

## More Information

* [Generated Grammar Diagram](https://jasongilman.github.io/willet-lang/grammar)
* [Example Project "Willet Breakout"](https://github.com/jasongilman/willet-breakout)

## Setting Jupyter Notebook and Hydrogen in Atom Editor

Setting up [jp-willet](https://github.com/jasongilman/jp-willet).

```Bash
# Install willet lang globally
npm install -g willet-lang

# Install jupyter package
cd jp-willet
npm install
npm install -g
# Reference willet lang through symlink to global package which points to willet in this project
npm link willet
# Install the Jupyter Kernel
jp-willet-install
```

Before Willet Grammar is available in atom set syntax to Java of some willet code and then configure hydrogen with this

```JSON
{ "willet": "Java" }
```
