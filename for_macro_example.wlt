// Example of for macro

// Give me all the addresses of users which are in Maryland
def mdAddresses = for(
  user wait(db.getUsers())
  address user.addresses
  :when address.state == 'MD') {
    address
  }


def foo = macro(args) {

}



//////////////////////////

foo = f

unless(true) {
  console.log("hello");
}

comment(
  ThisFunctionIsBroken()
)


r = 2 + 4

//////////

// 1. Bytes
// 4. AST we've got it


def comment = macro (args, body) => {
  null
}



[{trpe: BooleanLiteral value "true"}] body [ ]

def unless = macro(args, body) {
  [condition] = args
  quote(
    a = not(unquote(condition))
    if(a) {
      unquote(body)
    }
  )
}

map

#{

}

[

]

#[


]




// This could also be done with map

def mdAddresses = chain(
  db.getUsers()
  wait()
  flatMap((u) => u.addresses)
  filter((a) => a.state == 'MD')),

filter(
  flatMap(
    wait(db.getUsers()), (u) => u.addresses ),
    (a) => a.state == 'MD'
  )
)


(->)
