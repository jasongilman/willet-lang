
Program = stmts:StatementList {
  return {
    type: "Program",
    statements: stmts
  };
}

StatementList "statements" =
	_ stmt:Statement _ stmts:StatementList
	{
		stmts.unshift(stmt);
		return stmts;
	}

	/ _ stmt:Statement _
	{
		return [stmt];
	}


Statement = Assignment / ValueSequence / ValueReference

Assignment "assignment"
  = id:Symbol _ "=" _ v:(ValueSequence / ValueReference) {
	return {
		type: "Assignment",
		symbol: id,
		value: v
	};
}

ValueSequence =
	head:(
		v:ValueReference { return [v]; }
	)
	tail:(
		v:GetProperty { return [v]; }
		/ v:FunctionCall { return [v]; }
	)+
	{
		return {
			type: 'ValueSequence',
			values: Array.prototype.concat.apply(head, tail)
		};
	}

GetProperty = '.' v:Symbol {
  return {
    type: "GetProperty",
    attrib: v
  };
}

ValueReference =
  s:Symbol {
    return {
      type: "Reference",
      symbol: s
    };
  }
  / String / FunctionLiteral


FunctionCall "function call" =
	"(" _ a:ArgumentList? _ ")"
	{
		return {
			type: "FunctionCall",
			arguments: a,
		};
	}

ArgumentList "arguments" =
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
FunctionLiteral "function" = async:"async"? "(" _ a:ArgumentDecl? _ ")" _ "=>" _ body:FunctionBody
	{
		return {
			type: "Function",
			async: async !== null,
			arguments: a,
			statements: body
		};
	}

ArgumentDecl "arguments" =
	id:Symbol _ a:ArgumentDecl
	{
		a.unshift(id);
		return a;
	}
	/ id:Symbol
	{
		return [id];
	}

FunctionBody "function body" =
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

Symbol "symbol" = s:[A-Za-z0-9_]+
{
	return s.join("");
}

String "string"
  = quotation_mark chars:char* quotation_mark {
    return {
      type: "String",
      value: chars.join("")
    };
  }

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
