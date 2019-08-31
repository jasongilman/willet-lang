
StatementList = 
	_ stmt:Statement _ stmts:StatementList
	{
		stmts.unshift(stmt);
		return stmts;
	}

	/ _ stmt:Statement _
	{
		return [stmt];
	}


Statement = Const / Assignment / ValueSequence / ValueReference

Const = "const " _ a:Assignment
{
	return {
		type: "Const",
		assignment: a
	};
} 

Assignment = id:Symbol _ "=" _ s:Statement {
	return {
		type: "Assignment",
		symbol: id,
		statement: s
	};
}

ValueSequence =
	head:(
		v:ValueReference { return [v]; }
	)
	tail:(
		'.' v:Symbol { return [v]; }
		/ v:FunctionCall { return [v]; }
	)+ 
	{ 
		return {
			type: 'ValueSequence',
			values: Array.prototype.concat.apply(head, tail)
		};
	}
	

ValueReference = 
	Symbol / String / FunctionLiteral 
	
	
FunctionCall = 
	"(" _ a:ArgumentList? _ ")"
	{
		return {
			type: "FunctionCall",
			arguments: a,
		};
	}
	
ArgumentList = 
	e:ValueReference _ a:ArgumentList
	{
		a.unshift(e);
		return a;
	}
	/ e:ValueReference
	{
		return [e];
	}

// Function Literal
FunctionLiteral = async:"async"? "(" _ a:ArgumentDecl? _ ")" _ "=>" _ body:FunctionBody 
	{
		return {
			type: "Function",
			async: async !== null,
			arguments: a,
			statements: body
		};
	}

ArgumentDecl = 
	id:Symbol _ a:ArgumentDecl
	{
		a.unshift(id);
		return a;
	}
	/ id:Symbol 
	{
		return [id];
	}

FunctionBody =
	e:ValueReference
	{
		return [e];
	}
	/ "{" _ "}"
	{ 
		return []; 
	}
	/ "{" _ s:StatementList _ "}"
	{
		return s;
	}	

Symbol = s:[A-Za-z0-9_]+
{
	return {
		type: "Symbol",
		name:  s.join("")
	};
}

String
  = quotation_mark chars:char* quotation_mark { return chars.join(""); }

char
  = unescaped
  / escape
    sequence:(
        '"'
      / "\\"
      / "/"
      / "b" { return "\b"; }
      / "f" { return "\f"; }
      / "n" { return "\n"; }
      / "r" { return "\r"; }
      / "t" { return "\t"; }
      / "u" digits:$(HEXDIG HEXDIG HEXDIG HEXDIG) {
          return String.fromCharCode(parseInt(digits, 16));
        }
    )
    { return sequence; }

escape
  = "\\"

quotation_mark
  = '"'

unescaped
  = [^\0-\x1F\x22\x5C]


_ = [ ,\t\n\r]*

DIGIT  = [0-9]
HEXDIG = [0-9a-f]i