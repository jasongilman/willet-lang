# Willet
The Willet Programming Language

## Setting Jupyter Notebook and Hydrogen

Hacky initial description that allows seeing changes to willet lang immediately after making them

```Bash
# Install willet lang globally
npm install -g

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

## Ideas

types:

```
Code block
{}

Maps
#{}

Set
#[]

Array
[]

List/Seq?
()

Function call
fn()

Macro call
fn() {}? (Optional code block passed to macro)

```


## TODOs

* Add to npm
* Travis CI
* Update README
