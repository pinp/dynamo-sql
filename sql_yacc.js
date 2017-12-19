// sql_yacc.js
// LEX and YACC analyser for dynamo-sql

// Lexer, port from https://github.com/aaditmshah/lexer
//-----------------------------------------------------
function Lexer(defunct) {
  if (typeof defunct !== "function") defunct = Lexer.defunct;
  
  var tokens = [], rules = [], remove = 0;
  
  this.state = 0;
  this.index = 0;
  this.input = "";
  
  this.addRule = function (pattern, action, start) {
    var global = pattern.global;
    
    if (!global) {
      var flags = "g";
      if (pattern.multiline) flags += "m";
      if (pattern.ignoreCase) flags += "i";
      pattern = new RegExp(pattern.source, flags);
    }
    
    if (!Array.isArray(start)) start = [0];

    rules.push({
      pattern: pattern,
      global: global,
      action: action,
      start: start
    });

    return this;
  };

  this.setInput = function (input) {
    remove = 0;
    this.state = 0;
    this.index = 0;
    tokens.length = 0;
    this.input = input;
    return this;
  };

  this.lex = function () {
    if (tokens.length) return tokens.shift();

    this.reject = true;

    while (this.index <= this.input.length) {
      var matches = scan.call(this).splice(remove);
      var index = this.index;

      while (matches.length) {
        if (this.reject) {
          var match = matches.shift();
          var result = match.result;
          var length = match.length;
          this.index += length;
          this.reject = false;
          remove++;

          var token = match.action.apply(this, result);
          if (this.reject)
            this.index = result.index;
          else if (typeof token !== "undefined") {
            if (Array.isArray(token)) {
              tokens = token.slice(1);
              token = token[0];
            }
            if (length) remove = 0;
            return token;
          }
        }
        else break;
      }

      var input = this.input;

      if (index < input.length) {
        if (this.reject) {
          remove = 0;
          var token = defunct.call(this, input.charAt(this.index++));
          if (typeof token !== "undefined") {
            if (Array.isArray(token)) {
              tokens = token.slice(1);
              return token[0];
            }
            else return token;
          }
        }
        else {
          if (this.index !== index)
            remove = 0;
          this.reject = true;
        }
      }
      else if (matches.length)
        this.reject = true;
      else break;
    }
  };

  function scan() {
    var matches = [];
    var index = 0;

    var state = this.state;
    var lastIndex = this.index;
    var input = this.input;

    for (var i = 0, length = rules.length; i < length; i++) {
      var rule = rules[i];
      var start = rule.start;
      var states = start.length;

      if ((!states || start.indexOf(state) >= 0) ||
        (state % 2 && states === 1 && !start[0])) {
        var pattern = rule.pattern;
        pattern.lastIndex = lastIndex;
        var result = pattern.exec(input);

        if (result && result.index === lastIndex) {
          var j = matches.push({
            result: result,
            action: rule.action,
            length: result[0].length
          });

          if (rule.global) index = j;

          while (--j > index) {
            var k = j - 1;

            if (matches[j].length > matches[k].length) {
              var temple = matches[j];
              matches[j] = matches[k];
              matches[k] = temple;
            }
          }
        }
      }
    }

    return matches;
  }
}

Lexer.defunct = function(chr) {
  throw new Error('Unexpected character (' + chr + ') at offset (' + (this.index - 1) + ')');
};

//---------
var lexer = new Lexer();
var appendToken_ = function(lexeme,id) {};  // wait to overwrite

lexer.addRule(/\s+/, function(lexeme) {
  return appendToken_(lexeme,1);   // WHITE
}).addRule(/[0-9]+(?:\.[0-9]+)?\b/, function(lexeme) {
  return appendToken_(lexeme,2);   // NUMBER
}).addRule(/AND/, function(lexeme) {
  return appendToken_(lexeme,14);  // OP: AND
}).addRule(/OR/, function(lexeme) {
  return appendToken_(lexeme,14);  // OP: OR
}).addRule(/[_A-Za-z](?:[_A-Za-z0-9]+)?/, function(lexeme) {
  return appendToken_(lexeme,3);   // ID
}).addRule(/"(?:\\.|[^"])*"/, function(lexeme) { // "
  return appendToken_(lexeme,4);   // STRING
}).addRule(/[@]/, function(lexeme) {
  return appendToken_(lexeme,5);   // @
}).addRule(/[,]/, function(lexeme) {
  return appendToken_(lexeme,6);   // COMMA
}).addRule(/[\[]/, function(lexeme) {
  return appendToken_(lexeme,7);   // L_SQUARE
}).addRule(/[\]]/, function(lexeme) {
  return appendToken_(lexeme,8);   // R_SQUARE
}).addRule(/[(]/, function(lexeme) {
  return appendToken_(lexeme,9);   // L_PARENTHES
}).addRule(/[)]/, function(lexeme) {
  return appendToken_(lexeme,10);  // R_PARENTHES
}).addRule(/[.]/, function(lexeme) {
  return appendToken_(lexeme,11);  // joint: .
}).addRule(/[/]/, function(lexeme) {
  return appendToken_(lexeme,12);  // joint: /
}).addRule(/[+]/, function(lexeme) {
  return appendToken_(lexeme,13);  // OP: +
}).addRule(/[-]/, function(lexeme) {
  return appendToken_(lexeme,13);  // OP: -
}).addRule(/[<][>]/, function(lexeme) {
  return appendToken_(lexeme,13);  // OP: <>
}).addRule(/[<][=]/, function(lexeme) {
  return appendToken_(lexeme,13);  // OP: <=
}).addRule(/[<]/, function(lexeme) {
  return appendToken_(lexeme,13);  // OP: <
}).addRule(/[>][=]/, function(lexeme) {
  return appendToken_(lexeme,13);  // OP: >=
}).addRule(/[>]/, function(lexeme) {
  return appendToken_(lexeme,13);  // OP: >
}).addRule(/[=]/, function(lexeme) {
  return appendToken_(lexeme,13);  // OP: =
}).addRule(/$/, function(lexeme) {
  return appendToken_(lexeme,15);  // EOF   // 14: AND OR
});

// scanToken(sExpr) --> [bTok, ...]
//   bTok: [id,sToken,iOffset]
// --------------------------------
//  id       sToken
//   1     <WHITE SPACE>
//   2     <NUMBER>
//   3     <ID>
//   4     <STRING>
//   5     '@'
//   6     ','
//   7     '['
//   8     ']'
//   9     '('
//   10    ')'
//   11    '.'
//   12    '/'
//   13    '+'
//   13    '-'
//   13    '<>'
//   13    '<='
//   13    '<'
//   13    '>='
//   13    '>'
//   13    '='
//   14    'AND'
//   14    'OR'
//   15    <EOF>

function scanToken(sExpr) {
  var exprToken = [];
  
  appendToken_ = function(lexeme,id) {
    exprToken.push([id,lexeme,lexer.index-lexeme.length]);
    return id;
  };
  
  try {
    lexer.setInput(sExpr);
    while (lexer.lex()) ;      // maybe raise exception
  }
  catch(e) {
    console.log('error: lexical analysis failed.');
    console.log(e);
    return null;
  }
  
  return exprToken;
}

// -------- yacc rules --------
// [21] select_clause_1 : SELECT name_list FROM table_name
// [22] select_clause_2 : SELECT ( name_list ) FROM table_name
// [23] select_clause_3 : SELECT range_id FROM table_name
// [24] get_clause_1    : GET name_list FROM table_name
// [25] get_clause_2    : GET ( name_list ) FROM table_name
// [26] get_clause_3    : GET range_id FROM table_name
// [27] scan_clause_1   : SCAN name_list FROM table_name
// [28] scan_clause_2   : SCAN ( name_list ) FROM table_name
// [29] scan_clause_3   : SCAN range_id FROM table_name
// [30] put_clause      : PUT table_name
// [31] update_clause   : UPDATE table_name
// [32] delete_clause   : DELETE FROM table_name

// [40] action_clause   : select_clause | get_clause | scan_clause | put_clause | update_clause | delete_clause

// [41] by_clause_1     : BY id
// [42] by_clause_2     : BY id DESC
// [43] by_clause_3     : BY DESC

// [44] when_clause     : WHEN expr
// [45] where_clause    : WHERE expr
// [46] filter_clause   : FILTER expr
// [47] on_clause_1     : ON set_list
// [48] on_clause_2     : ON ( set_list )

// [51] set_clause_1    : SET set_list
// [52] set_clause_2    : SET ( set_list )
// [53] add_clause_1    : ADD set_list
// [54] add_clause_2    : ADD ( set_list )
// [55] del_clause_1    : DEL set_list
// [56] del_clause_2    : DEL ( set_list )
// [57] rmv_clause_1    : RMV name_list
// [58] rmv_clause_2    : RMV ( name_list )

// sql_stat   : action_clause (sub_clause)*
// sub_clause : by_clause | set_clause | add_clause | del_clause | rmv_clause | when_clause | where_clause | filter_clause | on_clause

//----------

// [81] range_id   : ALL | COUNT

// [101] attr_path_1   :  id
// [102] attr_path_2   :  attr_path . id
// [103] attr_path_3   :  attr_path [ NUMBER ]

// [111] name_list_1   :  attr_path
// [112] name_list_2   :  name_list , attr_path

// [121] table_name_1  :  id
// [122] table_name_2  :  table_name / id

// [131] expr_1        :  TRUE | FALSE | STRING | NUMBER    // NUMBER includes -N
// [132] expr_2        :  @ id
// [133] expr_3        :  attr_path
// [134] expr_4        :  id ( )
// [135] expr_5        :  id ( expr_list )
// [136] expr_6        :  expr OP expr
// [137] expr_7        :  ( expr )

// [141] expr_list_1   :  expr
// [142] expr_list_2   :  expr_list , expr

// [151] set_list_1    :  attr_path = expr
// [152] set_list_2    :  set_list , attr_path = expr

var dKeyword_ = {
  SELECT: 1, GET: 2, SCAN: 3, PUT: 4, UPDATE: 5, DELETE: 6,
  SET: 7, ADD: 8, DEL: 9, RMV: 10,
  BY: 11, WHEN: 12, WHERE: 13, FILTER: 14, ON: 15,
  
  FROM: 21, DESC: 22,
  TRUE: 31, FALSE: 32,
  ALL: 41, COUNT: 42,
};
var nameListAction_ = { SELECT:1, GET:2, SCAN:3, RMV:10 };

function isCondAction_(bTok) {
  var sTmp;
  return bTok[0] == 3 && ((sTmp=bTok[1]) == 'WHEN' || sTmp == 'WHERE' || sTmp == 'FILTER');
}

function isSetAction_(bTok) {
  var sTmp;
  return bTok[0] == 3 && ((sTmp=bTok[1]) == 'ON' || sTmp == 'SET' || sTmp == 'ADD' || sTmp == 'DEL');
}

function getOpLevel_(bTok) {
  var tp = bTok[0];
  if (tp == 14) {        // AND OR
    if (bTok[1] == 'AND')
      return 2;
    else return 1;
  }
  else if (tp == 13) {
    var s = bTok[1];
    if (s == '+' || s == '-')  // + -
      return 4;
    else return 3;       // <>  =  >=  >  <  <=
  }
  else return 0;
}

function adjustLevel_(iLevel,bLast3,bLast2,bLast) { // bLast3 must be expr_6
  var expr2 = bLast3[3];
  if (expr2[0] != 136)
    return [136,bLast3[1],bLast3[2],[136,expr2,bLast2,bLast]];
  else { // expr2 is expr_6
    if (getOpLevel_(expr2[2]) < iLevel)
      return [136,bLast3[1],bLast3[2],[136,expr2[1],expr2[2],[136,expr2[3],bLast2,bLast]]];
  }
  
  // adjust by inserting bLast2/bLast
  while (true) {  // // a = b OR b < c + 1 + 2
    var expr2_ = expr2[3];
    
    if (expr2_[0] != 136) {
      expr2[1] = expr2.slice(0);
      expr2[2] = bLast2;
      expr2[3] = bLast;
      break;
    }
    else if (getOpLevel_(expr2_[2]) < iLevel) {
      expr2_[3] = [136,expr2_[3],bLast2,bLast];
      break;
    }
    else expr2 = expr2_;
  }
  return bLast3;
}

function processYacc(bToken,isStrict) {  // first scan: setup AST
  var bPending = [];
  
  function commitId() {  // last one is id
    var iLen = bPending.length, bLast = bPending[iLen-1];
    if (iLen >= 2) {
      var bLast2 = bPending[iLen-2];
      if (iLen >= 3) {
        var bLast3 = bPending[iLen-3];
        if (bLast2[0] == 11 && bLast3[0] >= 101 && bLast3[0] <= 103) {
          bPending.splice(-3);
          bPending.push([102,bLast3,bLast2,bLast]);  // attr_path_2 : attr_path . id
          return true;
        }
        else if (bLast2[0] == 12 && bLast3[0] >= 121 && bLast3[0] <= 122) {
          bPending.splice(-3);
          bPending.push([122,bLast3,bLast2,bLast]);  // table_name_2 : table_name / id
          return true;
        }
      }
      
      if (bLast2[0] == 3) {  // id
        var s = bLast2[1];
        if (s == 'BY')
          return false;
        else if (s == 'FROM' || s == 'PUT' || s == 'UPDATE') {
          bPending[iLen-1] = [121,bLast]; // table_name_1 : id
          return true;
        }
      }
    }
    
    bPending[iLen-1] = [101,bLast]; // attr_path_1 : id
    return true;
  }
  
  function commitAttrPath() {  // last one is attr_path
    var iLen = bPending.length, bLast = bPending[iLen-1];
    if (iLen >= 2) {
      var iTmp, bLast2 = bPending[iLen-2];
      if (iLen >= 3) {
        var bLast3 = bPending[iLen-3], tpLast3 = bLast3[0];
        if (bLast2[0] == 6 && tpLast3 >= 111 && tpLast3 <= 112) {
          bPending.splice(-3);
          bPending.push([112,bLast3,bLast2,bLast]);  // name_list_2 : name_list , attr_path
          return true;
        }
        else if (bLast2[0] == 9 && bLast3[0] == 3 && nameListAction_[bLast3[1]]) {
          bPending[iLen-1] = [111,bLast]; // name_list_1 : attr_path
          return true;
        }
      }
      
      if (bLast2[0] == 3 && nameListAction_[bLast2[1]]) {
        bPending[iLen-1] = [111,bLast]; // name_list_1 : attr_path
        return true;
      }
    }
    
    bPending[iLen-1] = [133,bLast];     // expr_3 :  attr_path
    return true;
  }
  
  function commitExpr() {  // last one is expr
    var iLen = bPending.length, bLast = bPending[iLen-1];
    if (iLen >= 2) {
      var bLast2 = bPending[iLen-2], tpLast2= bLast2[0];
      if (iLen >= 3) {
        var bLast3 = bPending[iLen-3], tpLast3 = bLast3[0];
        if (tpLast3 >= 131 && tpLast3 <= 137 && tpLast2 >= 13 && tpLast2 <= 14) {
          bPending.splice(-3);
          
          var op2;  // different OP level: OR  =  +  // a = b OR b < c + 1
          if (tpLast3 == 136 && getOpLevel_(bLast3[2]) < (op2=getOpLevel_(bLast2))) {
            bPending.push(adjustLevel_(op2,bLast3,bLast2,bLast)); // [136,expr,OP,expr]
            commitExpr();  // last one still is expr
            return true;
          }
          else {
            bPending.push([136,bLast3,bLast2,bLast]);  // expr_6 : expr OP expr
            commitExpr();  // last one still is expr
            return true;
          }
        }
        else if (tpLast3 >= 101 && tpLast3 <= 103 && tpLast2 == 13 && bLast2[1] == '=') {
          if (iLen >= 5) {
            var bLast4 = bPending[iLen-4], bLast5 = bPending[iLen-5], tpLast5 = bLast5[0];
            if (bLast4[0] == 6 && tpLast5 >= 151 && tpLast5 <= 152) {
              bPending.splice(-5);
              bPending.push([152,bLast5,bLast4,bLast3,bLast2,bLast]); // set_list_2 : set_list , attr_path = expr
              return true;
            }
          }
          
          if (iLen >= 4) {
            var bLast4 = bPending[iLen-4];
            if (isCondAction_(bLast4)) {  // WHEN WHERE FILTER
              bPending.splice(-3);
              bLast3 = [133,bLast3];                    // expr_3 : attr_path
              bPending.push([136,bLast3,bLast2,bLast]); // expr_6 : expr OP expr
              return true;
            }
            
            if (bLast4[0] == 9 && iLen >= 5) {
              var bLast5 = bPending[iLen-5];
              if (isCondAction_(bLast5)) {    // such as: WHEN (field=xx)
                bPending.splice(-3);
                bPending.push([136,[133,bLast3],bLast2,bLast]); // expr_6 : expr OP expr
                return true;
              }
            }
          }
          
          bPending.splice(-3);
          bPending.push([151,bLast3,bLast2,bLast]);  // set_list_1 : attr_path = expr
          return true;
        }
        else if (tpLast3 >= 141 && tpLast3 <= 142 && tpLast2 == 6) {
          bPending.splice(-3);
          bPending.push([142,bLast3,bLast2,bLast]);  // expr_list_2 : expr_list , expr
          return true;
        }
        else if (tpLast2 == 9 && tpLast3 == 3 && !dKeyword_[bLast3[1]]) { // id ( expr
          bPending[iLen-1] = [141,bLast];            // expr_list_1 : expr
          return true;
        }
      }
    }
    
    return false;
  }
  
  function logLefting(sName,bLeft) {
    if (isStrict)
      throw new Error('Syntax error in clause (' + sName + ')');
    else console.log('Warning: unknown tail in clause (' + sName + '):',JSON.stringify(bLeft));
  }
  
  function makeClause(bClause) {
    var ret = null;
    var iLen = bClause.length, tok1 = bClause[0];
    if (tok1[0] != 3) return ret;
    
    var sName = tok1[1];
    if (sName == 'SELECT') {
      if (iLen >= 4) {
        var tok2 = bClause[1], tok3 = bClause[2], tok4 = bClause[3];
        if (iLen >= 6) {
          var tok5 = bClause[4], tok6 = bClause[5];
          if ( tok2[0] == 9 && tok3[0] >= 111 && tok3[0] <= 112 && tok4[0] == 10 &&
               tok5[0] == 3 && tok5[1] == 'FROM' && tok6[0] >= 121 && tok6[0] <= 122 ) {
            // select_clause_2 : SELECT ( name_list ) FROM table_name
            ret = [40,[22,tok1,tok2,tok3,tok4,tok5,tok6]]; // action_clause
            if (iLen > 6) logLefting(sName,bClause.slice(6));
          }
        }
        
        if (!ret) {
          if (tok3[0] == 3 && tok3[1] == 'FROM' && tok4[0] >= 121 && tok4[0] <= 122) {
            if (tok2[0] >= 111 && tok2[0] <= 112) {
              // select_clause_1 : SELECT name_list FROM table_name
              ret = [40,[21,tok1,tok2,tok3,tok4]]; // action_clause
              if (iLen > 4) logLefting(sName,bClause.slice(4));
            }
            else if (tok2[0] == 81) {
              // select_clause_3 : SELECT range_id FROM table_name
              ret = [40,[23,tok1,tok2,tok3,tok4]]; // action_clause
              if (iLen > 4) logLefting(sName,bClause.slice(4));
            }
          }
        }
      }
    }
    else if (sName == 'GET') {
      if (iLen >= 4) {
        var tok2 = bClause[1], tok3 = bClause[2], tok4 = bClause[3];
        if (iLen >= 6) {
          var tok5 = bClause[4], tok6 = bClause[5];
          if ( tok2[0] == 9 && tok3[0] >= 111 && tok3[0] <= 112 && tok4[0] == 10 &&
               tok5[0] == 3 && tok5[1] == 'FROM' && tok6[0] >= 121 && tok6[0] <= 122 ) {
            // get_clause_2 : GET ( name_list ) FROM table_name
            ret = [40,[25,tok1,tok2,tok3,tok4,tok5,tok6]]; // action_clause
            if (iLen > 6) logLefting(sName,bClause.slice(6));
          }
        }
        
        if (!ret) {
          if (tok3[0] == 3 && tok3[1] == 'FROM' && tok4[0] >= 121 && tok4[0] <= 122) {
            if (tok2[0] >= 111 && tok2[0] <= 112) {
              // get_clause_1 : GET name_list FROM table_name
              ret = [40,[24,tok1,tok2,tok3,tok4]]; // action_clause
              if (iLen > 4) logLefting(sName,bClause.slice(4));
            }
            else if (tok2[0] == 81) {
              // get_clause_3 : GET range_id FROM table_name
              ret = [40,[26,tok1,tok2,tok3,tok4]]; // action_clause
              if (iLen > 4) logLefting(sName,bClause.slice(4));
            }
          }
        }
      }
    }
    else if (sName == 'SCAN') {
      if (iLen >= 4) {
        var tok2 = bClause[1], tok3 = bClause[2], tok4 = bClause[3];
        if (iLen >= 6) {
          var tok5 = bClause[4], tok6 = bClause[5];
          if ( tok2[0] == 9 && tok3[0] >= 111 && tok3[0] <= 112 && tok4[0] == 10 &&
               tok5[0] == 3 && tok5[1] == 'FROM' && tok6[0] >= 121 && tok6[0] <= 122 ) {
            // scan_clause_2 : SCAN ( name_list ) FROM table_name
            ret = [40,[28,tok1,tok2,tok3,tok4,tok5,tok6]]; // action_clause
            if (iLen > 6) logLefting(sName,bClause.slice(6));
          }
        }
        
        if (!ret) {
          if (tok3[0] == 3 && tok3[1] == 'FROM' && tok4[0] >= 121 && tok4[0] <= 122) {
            if (tok2[0] >= 111 && tok2[0] <= 112) {
              // scan_clause_1 : SCAN name_list FROM table_name
              ret = [40,[27,tok1,tok2,tok3,tok4]]; // action_clause
              if (iLen > 4) logLefting(sName,bClause.slice(4));
            }
            else if (tok2[0] == 81) {
              // scan_clause_3 : SCAN range_id FROM table_name
              ret = [40,[29,tok1,tok2,tok3,tok4]]; // action_clause
              if (iLen > 4) logLefting(sName,bClause.slice(4));
            }
          }
        }
      }
    }
    else if (sName == 'PUT') {
      if (iLen >= 2) {
        var tok2 = bClause[1];
        if (tok2[0] >= 121 && tok2[0] <= 122) {
          // put_clause : PUT table_name
          ret = [40,[30,tok1,tok2]]; // action_clause
          if (iLen > 2) logLefting(sName,bClause.slice(2));
        }
      }
    }
    else if (sName == 'UPDATE') {
      if (iLen >= 2) {
        var tok2 = bClause[1];
        if (tok2[0] >= 121 && tok2[0] <= 122) {
          // update_clause : UPDATE table_name
          ret = [40,[31,tok1,tok2]]; // action_clause
          if (iLen > 2) logLefting(sName,bClause.slice(2));
        }
      }
    }
    else if (sName == 'DELETE') {
      if (iLen >= 3) {
        var tok2 = bClause[1], tok3 = bClause[2];
        if (tok2[0] == 3 && tok2[1] == 'FROM' && tok3[0] >= 121 && tok3[0] <= 122) {
          // delete_clause : DELETE FROM table_name
          ret = [40,[32,tok1,tok2,tok3]]; // action_clause
          if (iLen > 3) logLefting(sName,bClause.slice(3));
        }
      }
    }
    else if (sName == 'BY') {
      if (iLen >= 2) {
        var tok2 = bClause[1];
        if (iLen >= 3) {
          var tok3 = bClause[2];
          if (tok2[0] == 3 && tok3[0] == 3 && tok3[1] == 'DESC') {
            // by_clause_2 : BY id DESC
            ret = [42,tok1,tok2,tok3];
            if (iLen > 3) logLefting(sName,bClause.slice(3));
          }
        }
        
        if (!ret) {
          if (tok2[0] == 3) {
            if (tok2[1] == 'DESC') {
              // by_clause_3 : BY DESC
              ret = [43,tok1,tok2];
              if (iLen > 2) logLefting(sName,bClause.slice(2));
            }
            else {
              // by_clause_1 : BY id
              ret = [41,tok1,tok2];
              if (iLen > 2) logLefting(sName,bClause.slice(2));
            }
          }
        }
      }
    }
    else if (sName == 'WHEN' || sName == 'WHERE' || sName == 'FILTER') {
      var iFlag = sName == 'WHEN'? 44: (sName == 'WHERE'? 45: 46);
      if (iLen >= 2) {
        var tok2 = bClause[1];
        if (tok2[0] >= 131 && tok2[0] <= 137) {
          ret = [iFlag,tok1,tok2]; // when_clause, where_clause, filter_clause
          if (iLen > 2) logLefting(sName,bClause.slice(2));
        }
      }
    }
    else if (sName == 'ON' || sName == 'SET' || sName == 'ADD' || sName == 'DEL') {
      var iFlag = sName == 'ON'? 47: (sName == 'SET'? 51: (sName == 'ADD'? 53: 55));
      if (iLen >= 2) {
        var tok2 = bClause[1];
        if (iLen >= 4) {
          var tok3 = bClause[2], tok4 = bClause[3];
          if (tok2[0] == 9 && tok4[0] == 10 && tok3[0] >= 151 && tok3[0] <= 152) {
            // on_clause_2, set_clause_2, add_clause_2, del_clause_2
            ret = [iFlag+1,tok1,tok2,tok3,tok4];
            if (iLen > 4) logLefting(sName,bClause.slice(4));
          }
        }
        else {
          if (tok2[0] >= 151 && tok2[0] <= 152) {
            // on_clause_1, set_clause_1, add_clause_1, del_clause_1
            ret = [iFlag,tok1,tok2];
            if (iLen > 2) logLefting(sName,bClause.slice(2));
          }
        }
      }
    }
    else if (sName == 'RMV') {
      if (iLen >= 2) {
        var tok2 = bClause[1];
        if (iLen >= 4) {
          var tok3 = bClause[2], tok4 = bClause[3];
          if (tok2[0] == 9 && tok4[0] == 10 && tok3[0] >= 111 && tok3[0] <= 112) {
            // rmv_clause_2 : RMV ( name_list )
            ret = [58,tok1,tok2,tok3,tok4];
            if (iLen > 4) logLefting(sName,bClause.slice(4));
          }
        }
        
        if (!ret) {
          if (tok2[0] >= 111 && tok2[0] <= 112) {
            // rmv_clause_1 : RMV name_list
            ret = [57,tok1,tok2];
            if (iLen > 2) logLefting(sName,bClause.slice(2));
          }
        }
      }
    }
    return ret;
  }
  
  function commitOneClause(sName,idx) {
    var iLen = bPending.length;
    if (iLen == 0) return false;
    
    // step 1: find clause name
    if (!sName) {
      idx = iLen - 1;
      while (idx >= 0) {
        var iFlag, tok = bPending[idx];
        if (tok[0] == 3 && (sName=tok[1]) && (iFlag=dKeyword_[sName]) >= 1 && iFlag < 21)
          break;
        idx -= 1;
      }
      if (idx == iLen - 1) return false;  // clause keyword can not be last one
    }
    
    if (!sName || isNaN(idx) || idx < 0)
      throw new Error('Invalid SQL statement, should start with: SELECT, SCAN, UPDATE, PUT, GET, DELETE.');
    // else, success located last clause
    
    // step 2: check id conversion
    var bLast = bPending[iLen-1], iType = bLast[0];
    if (iType == 3 && !dKeyword_[bLast[1]] && iLen-1 > idx) { // ID
      if (commitId()) {  // maybe changing
        iLen = bPending.length;
        bLast = bPending[iLen-1];
        iType = bLast[0];
      }
    }
    
    // step 3: check attr_path conversion
    if (iType >= 101 && iType <= 103) { // attr_path
      if (commitAttrPath()) {
        iLen = bPending.length;
        bLast = bPending[iLen-1];
        iType = bLast[0];
      }
    }
    
    // step 4: check expr conversion
    if (iType >= 131 && iType <= 137) { // expr
      if (commitExpr()) {
        iLen = bPending.length;
        bLast = bPending[iLen-1];
        iType = bLast[0];
      }
    }
    
    // step 5: check sub_clause conversion
    if (bPending.length-1 > idx && bPending[idx][0] == 3) {
      var bClause = bPending.splice(idx);
      var clauseTok = makeClause(bClause);
      if (clauseTok) {
        bPending.push(clauseTok);
        return true;
      }
      console.log('Clause buffer:',JSON.stringify(bClause));
    }
    throw new Error('Syntax error in clause (' + sName + ')');
  }
  
  function checkNameList() {
    var iLen = bPending.length;
    if (iLen) {
      var tmp, bLast = bPending[iLen-1], tpLast = bLast[0];
      if (tpLast == 3 && !dKeyword_[bLast[1]]) {
        if (iLen >= 3 && bPending[iLen-2][0] == 11 && (tmp=bPending[iLen-3][0]) >= 101 && tmp <= 103) {  // attr_path . id
          bPending.splice(-3);
          bLast = [102,bPending[iLen-3],bPending[iLen-2],bLast];  // attr_path_2 : attr_path . id
          bPending.push(bLast);
          iLen = bPending.length;
          tpLast = 102;
        }
        else {
          bLast = bPending[iLen-1] = [101,bLast];  // attr_path_1 : id
          tpLast = 101;
        }
      }
      
      if (iLen >= 3) {
        var bLast2 = bPending[iLen-2], bLast3 = bPending[iLen-3];
        if (tpLast >= 101 && tpLast <= 103 && bLast2[0] == 6 && bLast3[0] >= 111 && bLast3[0] <= 112) {
          bPending.splice(-3);
          bLast = [112,bLast3,bLast2,bLast];  // name_list_2 : name_list , attr_path
          bPending.push(bLast);
          iLen = bPending.length;
          tpLast = 112;
        }
      }
      
      if (tpLast >= 101 && tpLast <= 103)
        bPending[iLen-1] = [111,bLast];       // name_list_1 : attr_path
    }
  }
  
  function processStep(tok) {
    var iType = tok[0];  // 1~14:token, 15:EOF, 21~40:action_clause, 41~58:sub_clause
        // 61~62:sql_stat, 131~137:expr, 141~142:expr_list, 151~152:set_list
        // 101~103:attr_path, 111~112:name_list, 121~122:table_name
    
    var iLen = bPending.length;
    if (iType == 15) {       // EOF
      if (iLen) commitOneClause();
    }
    else if (iType == 4) {   // STRING
      bPending.push([131,tok]);  // expr_1
    }
    else if (iType == 2) {   // NUMBER
      if (iLen) {
        var tmp, bLast = bPending[iLen-1], tpLast = bLast[0];
        if (tpLast == 7) {   // [
          bPending.push(tok);
        }
        else if ( tpLast == 13 && bLast[1] == '-' &&   // - Number
          (iLen <= 1 || ((tmp=bPending[iLen-2][0]) < 131 || tmp > 137)) ) { // prev not expr
          bPending.pop();
          tok[1] = '-' + tok[1];
          bPending.push([131,tok]);     // expr_1 : TRUE | FALSE | STRING | NUMBER
        }
        else bPending.push([131,tok]);  // expr_1
      }
      else bPending.push(tok);
    }
    else if (iType == 3) {  // ID
      var idFlag = dKeyword_[tok[1]] || 0;
      if (idFlag >= 41) {   // ALL COUNT
        if (iLen) {
          var sLast, bLast = bPending[iLen-1], tpLast = bLast[0];
          if (tpLast == 3 && ((sLast=bLast[1]) == 'SELECT' || sLast == 'GET' || sLast == 'SCAN'))
            bPending.push([81,tok]);    // range_id   : ALL | COUNT
          else bPending.push(tok);
        }
        else bPending.push(tok);
      }
      else if (idFlag >= 31)       // TRUE FALSE
        bPending.push([131,tok]);  // expr_1
      else if (idFlag >= 21) {     // keyword: FROM DESC
        if (idFlag == 21)          // FROM
          checkNameList();
        bPending.push(tok);
      }
      else if (idFlag >= 1) {      // sub_clause keyword
        if (iLen)
          commitOneClause();       // no need update: iLen = bPending.length;
        bPending.push(tok);
      }
      else { // is normal ID
        if (iLen) {
          var sLast, bLast = bPending[iLen-1], tpLast = bLast[0];
          if (tpLast == 5) {       // @
            bPending.pop();
            bPending.push([132,bLast,tok]); // expr_2 :  @ id
          }
          else if (tpLast == 10) { // .
            if (iLen >= 2) {
              var bLast2 = bPending[iLen-2], tpLast2 = bLast2[0];
              if (tpLast2 >= 101 && tpLast2 <= 103) {   // is attr_path
                bPending.splice(-2,2);
                bPending.push([102,bLast2,bLast,tok]);  // attr_path_2 : attr_path . id
              }
              else bPending.push(tok);
            }
            else bPending.push(tok);
          }
          else if (tpLast == 11) { // /
            if (iLen >= 2) {
              var bLast2 = bPending[iLen-2], tpLast2 = bLast2[0];
              if (tpLast2 >= 121 && tpLast2 <= 122) {   // is table_name
                bPending.splice(-2,2);
                bPending.push([122,bLast2,bLast,tok]);  // table_name_2 : table_name / id
              }
              else bPending.push(tok);
            }
            else bPending.push(tok);
          }
          else if (tpLast == 6)        // ,
            bPending.push([101,tok]);  // attr_path_1 : id
          else bPending.push(tok);
        }
        else bPending.push(tok);
      }
    }
    else if (iType == 11) {  // .
      if (iLen) {
        var bLast = bPending[iLen-1];
        if (bLast[0] == 3 && !dKeyword_[bLast[1]]) { // id
          if (iLen >= 3) {
            var bLast2 = bPending[iLen-2], bLast3 = bPending[iLen-3];
            if (bLast2[0] == 11 && bLast3[0] >= 101 && bLast3[0] <= 103) {
              bPending.splice(-3);
              bPending.push([102,bLast3,bLast2,bLast]); // attr_path_2 : attr_path . id
            }
            else bPending[iLen-1] = [101,bLast]; // attr_path_1 : id
          }
          else bPending[iLen-1] = [101,bLast];   // attr_path_1 : id
        }
      }
      bPending.push(tok);
    }
    else if (iType == 12) {  // /
      if (iLen) {
        var bLast = bPending[iLen-1];
        if (bLast[0] == 3 && !dKeyword_[bLast[1]]) {    // id
          if (iLen >= 3) {
            var bLast2 = bPending[iLen-2], bLast3 = bPending[iLen-3];
            if (bLast2[0] == 12 && bLast3[0] >= 121 && bLast3[0] <= 122) {
              bPending.splice(-3);
              bPending.push([122,bLast3,bLast2,bLast]); // table_name_2 : table_name / id
            }
            else bPending[iLen-1] = [121,bLast];  // table_name_1 : id
          }
          else bPending[iLen-1] = [121,bLast];    // table_name_1 : id
        }
      }
      bPending.push(tok);
    }
    else if (iType == 7) {  // [
      if (iLen) {
        var bLast = bPending[iLen-1];
        if (bLast[0] == 3 && !dKeyword_[bLast[1]]) {    // id
          if (iLen >= 3) {
            var bLast2 = bPending[iLen-2], bLast3 = bPending[iLen-3];
            if (bLast2[0] == 11 && bLast3[0] >= 101 && bLast3[0] <= 103) {
              bPending.splice(-3);
              bPending.push([102,bLast3,bLast2,bLast]); // attr_path_2 : attr_path . id
            }
            else bPending[iLen-1] = [101,bLast];  // attr_path_1 : id
          }
          else bPending[iLen-1] = [101,bLast];    // attr_path_1 : id
        }
      }
      bPending.push(tok);
    }
    else if (iType == 8) {  // ]
      if (iLen >= 3) {
        var bLast = bPending[iLen-1], bLast2 = bPending[iLen-2], bLast3 = bPending[iLen-3];
        if (bLast[0] == 2 && bLast2[0] == 7 && bLast3[0] >= 101 && bLast3[0] <= 103) {
          bPending.splice(-3,3);
          bPending.push([103,bLast3,bLast2,bLast,tok]); // attr_path_3 : attr_path [ NUMBER ]
        }
        else bPending.push(tok);
      }
      else bPending.push(tok);
    }
    else if (iType == 13) {  // '=' or other OP
      if (iLen) {
        var sOp = tok[1], bLast = bPending[iLen-1];
        if (sOp == '=') {
          var tpLast = bLast[0];
          if (tpLast == 3 && !dKeyword_[bLast[1]] && commitId()) {
            iLen   = bPending.length;
            bLast  = bPending[iLen-1];
            tpLast = bLast[0];
          }
          
          if (tpLast >= 101 && tpLast <= 103 && iLen >= 2) {
            var tmp, bLast2 = bPending[iLen-2];
            if (isSetAction_(bLast2) || (bLast2[0] == 9 && iLen >= 3 && isSetAction_(bPending[iLen-3])))
              ;    // keep attr=xx for: 1) ON/SET/ADD/DEL attr=xx  2) ON/SET/ADD/DEL ( attr=xx
            else if (bLast2[0] == 6 && iLen >= 3 && (tmp=bPending[iLen-3][0]) >= 151 && tmp <= 152)
              ;    // keep attr=xx for: set_list , attr =
            else   // others, attr=xx  -->  expr=xx   // take '=' as OP, not assignment 
              bPending[iLen-1] = [133,bLast]; // expr_3 : attr_path
          }
          
          bPending.push(tok);
        }
        else {  // sOp is normal OP
          if (bLast[0] == 3 && !dKeyword_[bLast[1]] && commitId()) {
            iLen  = bPending.length;
            bLast = bPending[iLen-1];
          }
          
          if (bLast[0] >= 101 && bLast[0] <= 103)
            bPending[iLen-1] = [133,bLast]; // expr_3 : attr_path
          
          bPending.push(tok);
        }
      }
      else bPending.push(tok);
    }
    else if (iType == 14) {  // AND OR
      if (iLen) {
        var bLast = bPending[iLen-1];
        if (bLast[0] == 3 && !dKeyword_[bLast[1]] && commitId()) {
          iLen  = bPending.length;
          bLast = bPending[iLen-1];
        }
        
        var tpLast = bLast[0];
        if (tpLast >= 101 && tpLast <= 103 && commitAttrPath()) {
          iLen  = bPending.length;
          bLast = bPending[iLen-1];
          tpLast = bLast[0];
        }
        
        if (tpLast >= 131 && tpLast <= 137)
          commitExpr();
      }
      bPending.push(tok);
    }
    else if (iType == 9) {  // (
      bPending.push(tok);
    }
    else if (iType == 10) { // )
      var done = false;
      if (iLen) {
        var bLast = bPending[iLen-1], tpLast = bLast[0];
        if (tpLast == 3 && !dKeyword_[bLast[1]] && commitId()) {
          iLen = bPending.length;
          bLast = bPending[iLen-1];
          tpLast = bLast[0];
        }
        
        if (tpLast >= 101 && tpLast <= 103 && commitAttrPath()) {
          iLen = bPending.length;
          bLast = bPending[iLen-1];
          tpLast = bLast[0];
        }
        
        if (tpLast >= 131 && tpLast <= 137 && commitExpr()) {
          iLen = bPending.length;
          bLast = bPending[iLen-1];
          tpLast = bLast[0];
        }
        
        if (iLen >= 2) {
          var bLast2 = bPending[iLen-2];
          if (iLen >= 3) {
            var bLast3 = bPending[iLen-3];
            if (bLast2[0] == 9 && bLast3[0] == 3 && !dKeyword_[bLast3[1]] && tpLast >= 141 && tpLast <= 142) {
              bPending.splice(-3);
              bPending.push([135,bLast3,bLast2,bLast,tok]); // expr_5 : id ( expr_list )
              done = true;
            }
          }
          
          if (!done) {
            if (bLast2[0] == 9 && tpLast >= 131 && tpLast <= 137) {
              bPending.splice(-2);
              bPending.push([137,bLast2,bLast,tok]); // expr_7 : ( expr )
              done = true;
            }
            else if (bLast[0] == 9 && bLast2[0] == 3 && !dKeyword_[bLast2[1]]) {
              bPending.splice(-2);
              bPending.push([134,bLast2,bLast,tok]); // expr_4 : id ( )
              done = true;
            }
          }
        }
      }
      
      if (!done) bPending.push(tok);
    }
    else if (iType == 6) {   // ,
      if (iLen) {
        var bLast = bPending[iLen-1], tpLast = bLast[0];
        if (tpLast == 3 && !dKeyword_[bLast[1]] && commitId()) {
          iLen = bPending.length;
          bLast = bPending[iLen-1];
          tpLast = bLast[0];
        }
        
        if (tpLast >= 101 && tpLast <= 103 && commitAttrPath()) {
          iLen = bPending.length;
          bLast = bPending[iLen-1];
          tpLast = bLast[0];
        }
        
        if (tpLast >= 131 && tpLast <= 137 && commitExpr()) {
          iLen = bPending.length;
          bLast = bPending[iLen-1];
          tpLast = bLast[0];
        }
      }
      
      bPending.push(tok);
    }
    else bPending.push(tok); // such as: @
  }
  
  var tok;
  while (tok = bToken.shift()) {
    if (tok[0] != 1)  // not white space
      processStep(tok);
  }
  
  if (bPending.length == 0)
    throw new Error('Expression is empty');
  else {
    tok = bPending[0];
    if (tok[0] != 40) {
      console.log('Pending buffer:',JSON.stringify(bPending));
      throw new Error('Syntax error in action clause.'); // should be one of: SELECT, GET, SCAN, PUT, UPDATE, DELETE
    }
    
    for (var ii=1; tok=bPending[ii]; ii += 1) {
      if (tok[0] < 41 || tok[0] > 58) {
        console.log('Pending buffer:',JSON.stringify(bPending.slice(ii)));
        throw new Error('Unknown syntax in clause: ' + (ii+1));
      }
    }
    
    return bPending;
  }
}

module.exports = {
  scanToken: scanToken,
  
  setupAst: function(tokens,isStrict) {
    var exprToken = typeof tokens == 'string'? scanToken(tokens): tokens;
    if (!Array.isArray(exprToken)) return null; // fatal error
    
    try {
      return processYacc(exprToken,isStrict);   // maybe raise exception
    }
    catch(e) {
      console.log('error: yacc analysis failed.');
      console.log(e);
      return null;
    }
  },
};
