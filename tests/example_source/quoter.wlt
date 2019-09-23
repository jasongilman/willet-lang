def quoter = fn (value) quote(
  if (true) {
    console.log("hello" unquote(value))
  }
)
let module.exports = #{ quoter }
