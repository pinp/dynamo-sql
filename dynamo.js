// dynamo.js
// translate SQL to dynamoDB's API

// Usage:
//--------
// var AWS = require('aws-sdk');
// var dynSql = require('dynamo-sql');
//
// dynSql.init(AWS);
//
// var sql = dynSql.newSql('UPDATE table_test WHEN sId="abcd" AND nTime=3 ADD mValue.aSet=@aSet ON return="ALL_NEW"');
// sql.log();
//
// sql.process({aSet:dynSql.newSet([1,2])}, function(err,data) {
//   if (err) {
//     console.log(err);
//     return;
//   }
//   console.log(data);
// },true);  // logCmd=true means printing parameters of dynamoDB API

var yacc = require('./sql_yacc');

//--------------------------------
function getTableName_(tableExpr) {
  if (tableExpr[0] == 122)
    return getTableName_(tableExpr[1]) + '/' + tableExpr[3][1];
  else return tableExpr[1][1];
}

function getAttrName_(tok) {
  var tp = tok[0];
  if (tp == 101)
    return tok[1][1];
  else if (tp == 102)
    return getAttrName_(tok[1]) + '.' + tok[3][1];
  else // tp == 103
    return getAttrName_(tok[1]) + '[' + tok[3][1] + ']';
}

function scanNameList_(nameList,attrNames) {
  var bRet = [];
  scanName(nameList);
  return bRet;
  
  function scanName(tok) {
    var attrPath;
    if (tok[0] == 112) {  // 112: name_list_2
      scanName(tok[1]);
      attrPath = tok[3];
    }
    else attrPath = tok[1];
    
    var sName = getAttrName_(attrPath);
    var sName2 = sName.replace(/[_A-Za-z](?:[_A-Za-z0-9]+)?/g, function(s) {
      attrNames['#'+s] = s;
      return '#' + s;
    });
    bRet.push(sName2);
  }
}

var cond_func_ = { not_of:true, exists_in:true, between:true, 
  begins_with:true, attribute_exists:true, attribute_not_exists:true,
  attribute_type:true, contains:true, size:true,
};

function setupCondition_(condExpr,attrNames,attrValues,forKey,idxFrom) {
  var sRet = '';
  var strIndex = idxFrom, numIndex = idxFrom;
  
  if (forKey) {   // available root-expr:  id(...)   expr OP expr   (expr)
    if (condExpr[0] < 134) // expr_1, expr_2, expr_3 
      throw new Error('Invalid key condition expression');
  }
  scanCondition(condExpr,0,false);
  
  return sRet;
  
  function scanExprList(exprList,iLevel) {
    if (exprList[0] == 142) {  // expr_list_2 : expr_list , expr
      scanExprList(exprList[1],iLevel);
      sRet += ',';
      scanCondition(exprList[3],iLevel,false);
    }
    else scanCondition(exprList[1],iLevel,false);  // expr_list_1 : expr
  }
  
  function scanCondition(condExpr,iLevel,inNot) {
    var tp = condExpr[0];
    if (tp >= 134 && tp <= 135) {  // id ( )    id ( expr_list )
      var sFunc = condExpr[1][1], funcOK = true;
      if (forKey) {
        if (sFunc != 'begins_with' && sFunc != 'between')
          funcOK = false;
      }
      else { // for filter: not_of, exists_in, between, begins_with, attribute_exists, attribute_not_exists, attribute_type, contains, size
        if (!cond_func_[sFunc]) funcOK = false;
      }
      if (!funcOK) throw new Error('Invalid function (' + sFunc + ')');
      
      if (sFunc == 'not_of') {
        var exprList = condExpr[3];
        if (exprList[0] == 141) {
          sRet += ' NOT (';
          scanCondition(exprList[1],iLevel+1,true);
          sRet += ')';
        }
        else throw new Error('Syntax error: not_of');
      }
      else if (sFunc == 'exists_in') { // exists_in(expr,aSet)
        var exprList = condExpr[3], succ = false;
        if (exprList[0] == 142) {
          var subList = exprList[1], subList2 = exprList[3];
          if (subList[0] == 141) {
            if (iLevel > 0 && !inNot) sRet += ' (';
            scanCondition(subList[1],iLevel+1,false);
            sRet += ' IN';
            scanCondition(subList2,iLevel+1,false);
            if (iLevel > 0 && !inNot) sRet += ')';
            succ = true;
          }
        }
        if (!succ) throw new Error('Syntax error: ' + sFunc);
      }
      else if (sFunc == 'between') { // between(field,b,c)
        var exprList = condExpr[3], succ = false;
        if (exprList[0] == 142) {
          var subList = exprList[1], subList3 = exprList[3];
          if (subList[0] == 142) {
            var subList_ = subList[1], subList2 = subList[3];
            if (subList_[0] == 141) {
              if (iLevel > 0 && !inNot) sRet += ' ('
              scanCondition(subList_[1],iLevel+1,false);
              sRet += ' BETWEEN';
              scanCondition(subList2,iLevel+1,false);
              sRet += ' AND';
              scanCondition(subList3,iLevel+1,false);
              if (iLevel > 0 && !inNot) sRet += ')';
              succ = true;
            }
          }
        }
        if (!succ) throw new Error('Syntax error: between()');
      }
      else {
        sRet += ' ' + sFunc + '(';
        if (tp == 135) scanExprList(condExpr[3],iLevel+1);
        sRet += ')';
      }
    }
    else if (tp == 136) {  // expr OP expr
      var opTok = condExpr[2], opTp = opTok[0], sOp = opTok[1];
      if (opTp == 13) {
        var opOK = true;
        if (forKey) {
          if (sOp == '+' || sOp == '-' || sOp == '<>')
            opOK = false;
        }
        else {
          if (sOp == '+' || sOp == '-')
            opOK = false;
        }  
        if (!opOK) throw new Error('Invalid operator: ' + sOp);
      }
      
      if (iLevel > 0 && !inNot) sRet += ' (';
      scanCondition(condExpr[1],iLevel+1,false);
      sRet += ' ' + sOp;
      scanCondition(condExpr[3],iLevel+1,false);
      if (iLevel > 0 && !inNot) sRet += ')';
    }
    else if (tp == 137) {  // ( expr )
      if (iLevel > 0 && !inNot) sRet += ' (';
      scanCondition(condExpr[2],iLevel+1,false);
      if (iLevel > 0 && !inNot) sRet += ')';
    }
    else if (tp == 131) {  // TRUE | FALSE | STRING | NUMBER
      var valueTok = condExpr[1], tokTp = valueTok[0];
      if (tokTp == 3) {    // TRUE or FALSE
        var sTok = ':' + valueTok[1];
        attrValues[sTok] = (sTok == ':TRUE'?1:0);
        sRet += ' ' + sTok;
      }
      else if (tokTp == 4) { // STRING
        strIndex += 1;
        var sTok = ':_s' + strIndex;
        attrValues[sTok] = valueTok[1].slice(1,-1);
        sRet += ' ' + sTok;
      }
      else {                 // tokTp == 2: NUMBER
        numIndex += 1;
        var sTok = ':_n' + numIndex;
        attrValues[sTok] = parseFloat(valueTok[1]);
        sRet += ' ' + sTok;
      }
    }
    else if (tp == 132) {    // @ id
      sRet += ' :' + condExpr[2][1];
    }
    else {  // tp == 133     // attr_path
      var valueTok = condExpr[1], sAttr = getAttrName_(valueTok);
      if (forKey && valueTok[0] != 101)  // id.xx or id[xx]
        throw new Error('Invalid attribute (' + sAttr + ')');
      
      var sAttr2 = sAttr.replace(/[_A-Za-z](?:[_A-Za-z0-9]+)?/g, function(s) {
        attrNames['#'+s] = s;
        return '#' + s;
      });
      sRet += ' ' + sAttr2;
    }
  }
}

function setupOnList_(dRet,counter,attrValues,setList) {
  var leftExpr, rightExpr;
  if (setList[0] == 152) {  // set_list_2 : set_list , attr_path = expr
    setupOnList_(dRet,counter,attrValues,setList[1]);
    leftExpr = setList[3];
    rightExpr = setList[5];
  }
  else {  // set_list_1 : attr_path = expr
    leftExpr = setList[1];
    rightExpr = setList[3];
  }
  
  if (leftExpr[0] == 101) {
    var value = scanOptValue(rightExpr);  // value should be: undefined or ':xxx'
    if (value !== undefined)
      dRet[leftExpr[1][1]] = value;
  }
  else console.log('warning: invalid assignment in ON');
  
  function scanOptValue(expr) {
    var tp = expr[0];
    if (tp == 131) {         // expr_1 : TRUE | FALSE | STRING | NUMBER
      var valueTok = expr[1], tokTp = valueTok[0];
      if (tokTp == 3) {      // TRUE or FALSE
        var sTok = ':' + valueTok[1];
        attrValues[sTok] = (sTok == ':TRUE'?1:0);
        return sTok;
      }
      else if (tokTp == 4) { // STRING
        counter.strIndex += 1;
        var sTok = ':_s' + counter.strIndex;
        attrValues[sTok] = valueTok[1].slice(1,-1);
        return sTok;
      }
      else {                 // tokTp == 2: NUMBER
        counter.numIndex += 1;
        var sTok = ':_n' + counter.numIndex;
        attrValues[sTok] = parseFloat(valueTok[1]);
        return sTok;
      }
    }
    else if (tp == 132) {    // expr_2 : @ id
      return ':' + expr[2][1];
    }
    return undefined;
  }
}

function getRefValue_(counter,attrNames,attrValues,condExpr,canModi,isParam) {
  var tp = condExpr[0];
  if (tp == 131) {         // TRUE | FALSE | STRING | NUMBER
    var valueTok = condExpr[1], tokTp = valueTok[0];
    if (tokTp == 3) {      // TRUE or FALSE
      var sTok = ':' + valueTok[1];
      attrValues[sTok] = (sTok == ':TRUE'?1:0);
      return sTok;
    }
    else if (tokTp == 4) { // STRING
      counter.strIndex += 1;
      var sTok = ':_s' + counter.strIndex;
      attrValues[sTok] = valueTok[1].slice(1,-1);
      return sTok;
    }
    else {                 // tokTp == 2: NUMBER
      counter.numIndex += 1;
      var sTok = ':_n' + counter.numIndex;
      attrValues[sTok] = parseFloat(valueTok[1]);
      return sTok;
    }
  }
  else if (tp == 132) {    // @ id
    return ':' + condExpr[2][1];
  }
  else if (tp == 133) {
    if (canModi) {
      var attrPath = condExpr[1], sName = getAttrName_(attrPath);
      var sName2 = sName.replace(/[_A-Za-z](?:[_A-Za-z0-9]+)?/g, function(s) {
        attrNames['#'+s] = s;
        return '#' + s;
      });
      return sName2;
    }
  }
  else if (tp == 134) {  // id ( )
    if (canModi) {
      return condExpr[1][1] + '()';
    }
  }
  else if (tp == 135) {  // id ( expr_list )
    if (canModi) {
      return condExpr[1][1] + '(' + scanExprList(condExpr[3]) + ')';
    }
  }
  else if (tp == 136) {  // expr OP expr
    if (canModi && !isParam) {
      var sOp = condExpr[2][1];
      if (sOp == '+' || sOp == '-') {
        var sLeft = getRefValue_(counter,attrNames,attrValues,condExpr[1],canModi,isParam);
        var sRight = getRefValue_(counter,attrNames,attrValues,condExpr[3],canModi,isParam);
        return sLeft + ' ' + sOp + ' ' + sRight;
      }
    }
  }
  else if (tp == 137) {  // ( expr )
    return getRefValue_(counter,attrNames,attrValues,condExpr[2],canModi,isParam);
  }
  
  throw new Error('Invalid reference');
  
  function scanExprList(exprList) {
    var exprR, sRet = '';
    if (exprList[0] == 142) {  // expr_list_2 : expr_list , expr
      exprR = exprList[3];
      sRet = scanExprList(exprList[1]) + ',';
    }
    else exprR = exprList[1];  // expr_list_1 : expr
    
    sRet += getRefValue_(counter,attrNames,attrValues,exprR,true,true);
    return sRet;
  }
}

function setupWhenKey_(whenExpr,attrNames,attrValues,idxFrom) {
  var dKey = {}, counter = {strIndex:idxFrom, numIndex:idxFrom};
  
  scanCondExpr(whenExpr);
  return dKey;
  
  function scanCondExpr(condExpr) {
    var tp = condExpr[0];
    if (tp == 137) {      // ( expr )
      scanCondExpr(condExpr[2]);
      return;
    }
    else if (tp == 136) { // expr OP expr
      var opTok = condExpr[2], sOp = opTok[1];
      var exprL = condExpr[1], exprR = condExpr[3];
      
      if (sOp == 'AND') {
        scanCondExpr(exprL);
        scanCondExpr(exprR);
        return;
      }
      else if (sOp == '=') {
        var tmp;
        if (exprL[0] == 133 && (tmp=exprL[1]) && tmp[0] == 101) {  // expr_3 : attr_path
          var sName = tmp[1][1], sValue = getRefValue_(counter,attrNames,attrValues,exprR,false);
          dKey[sName] = sValue;
          // attrNames['#'+sName] = sName;  // no need record attrNames
          return;
        }
      }
      throw new Error('Invalid operator: ' + sOp);
    }
    
    throw new Error('Invalid WHEN condition');
  }
}

function setupPutList_(setList,attrNames,attrValues,idxFrom) {
  var dItem = {}, counter = {strIndex:idxFrom, numIndex:idxFrom};
  
  scanSetList(setList);
  return dItem;
  
  function scanSetList(setList) {
    var attrPath, exprR;
    if (setList[0] == 152) {  // set_list_2 : set_list , attr_path = expr
      scanSetList(setList[1]);
      attrPath = setList[3];
      exprR = setList[5];
    }
    else {  // set_list_1 : attr_path = expr
      attrPath = setList[1];
      exprR = setList[3];
    }
    
    if (attrPath[0] == 101) {
      var sName = attrPath[1][1];
      dItem[sName] = getRefValue_(counter,attrNames,attrValues,exprR,true); // maybe include + -
      // attrNames['#'+sName] = sName;  // no need record
    }
    else console.log('warning: invalid assignment in SET');
  }
}

function setupUpdateCmd_(dClause,attrNames,attrValues,idxFrom) {
  var setExpr = dClause.SET, rmvExpr = dClause.RMV, addExpr = dClause.ADD, delExpr = dClause.DEL;
  if (!setExpr && !rmvExpr && !addExpr && !delExpr)
    throw new Error('Absent of SET, RMV, ADD, DEL');
  
  var setRet = '', rmvRet = '', addRet = '', delRet = '';
  var counter = {strIndex:idxFrom, numIndex:idxFrom};
  
  if (setExpr) scanSetExpr(setExpr[0]==52?setExpr[3]:setExpr[2]);
  if (addExpr) scanAddExpr(addExpr[0]==54?addExpr[3]:addExpr[2]);
  if (delExpr) scanDelExpr(delExpr[0]==56?delExpr[3]:delExpr[2]);
  if (rmvExpr) scanRmvExpr(rmvExpr[0]==58?rmvExpr[3]:rmvExpr[2]);
  
  return setRet + ' ' + addRet + ' ' + delRet + ' ' + rmvRet;
  
  function scanSetExpr(setList) {
    var attrPath, exprR;
    if (setList[0] == 152) {  // set_list_2 : set_list , attr_path = expr
      scanSetExpr(setList[1]);
      attrPath = setList[3];
      exprR = setList[5];
    }
    else {  // set_list_1 : attr_path = expr
      attrPath = setList[1];
      exprR = setList[3];
    }
    
    var sName = getAttrName_(attrPath);
    var sName2 = sName.replace(/[_A-Za-z](?:[_A-Za-z0-9]+)?/g, function(s) {
      attrNames['#'+s] = s;
      return '#' + s;
    });
    var value = getRefValue_(counter,attrNames,attrValues,exprR,true);
    if (setRet)
      setRet += ',';
    else setRet = 'SET ';
    setRet += sName2 + ' = ' + value;
  }
  
  function scanAddExpr(setList) {
    var attrPath, exprR;
    if (setList[0] == 152) {  // set_list_2 : set_list , attr_path = expr
      scanAddExpr(setList[1]);
      attrPath = setList[3];
      exprR = setList[5];
    }
    else {  // set_list_1 : attr_path = expr
      attrPath = setList[1];
      exprR = setList[3];
    }
    
    var sName = getAttrName_(attrPath);
    var sName2 = sName.replace(/[_A-Za-z](?:[_A-Za-z0-9]+)?/g, function(s) {
      attrNames['#'+s] = s;
      return '#' + s;
    });
    var value = getRefValue_(counter,attrNames,attrValues,exprR,true);
    if (addRet)
      addRet += ',';
    else addRet = 'ADD ';
    addRet += sName2 + ' ' + value;
  }
  
  function scanDelExpr(setList) {
    var attrPath, exprR;
    if (setList[0] == 152) {  // set_list_2 : set_list , attr_path = expr
      scanDelExpr(setList[1]);
      attrPath = setList[3];
      exprR = setList[5];
    }
    else {  // set_list_1 : attr_path = expr
      attrPath = setList[1];
      exprR = setList[3];
    }
    
    var sName = getAttrName_(attrPath);
    var sName2 = sName.replace(/[_A-Za-z](?:[_A-Za-z0-9]+)?/g, function(s) {
      attrNames['#'+s] = s;
      return '#' + s;
    });
    var value = getRefValue_(counter,attrNames,attrValues,exprR,true);
    if (delRet)
      delRet += ',';
    else delRet = 'DELETE ';
    delRet += sName2 + ' ' + value;
  }
  
  function scanRmvExpr(nameList) { // remove field or remove array item
    var attrPath;
    if (nameList[0] == 112) {    // name_list_2 : name_list , attr_path
      scanRmvExpr(nameList[1]);
      attrPath = nameList[3];
    }
    else attrPath = nameList[1]; // name_list_1 : attr_path
    
    var sName = getAttrName_(attrPath);
    var sName2 = sName.replace(/[_A-Za-z](?:[_A-Za-z0-9]+)?/g, function(s) {
      attrNames['#'+s] = s;
      return '#' + s;
    });
    if (rmvRet)
      rmvRet += ',';
    else rmvRet = 'REMOVE ';
    rmvRet += sName2;
  }
}

var dynDC = null;

function dynSql(actName,params,attrNames,attrValues,onConfig) {
  this.actName    = actName;
  this.params     = params;
  this.attrNames  = attrNames;
  this.attrValues = attrValues;
  this.onConfig   = onConfig;
}

function defaultCallback_(err,data) {
  console.log(err || data);
}

dynSql.prototype = {
  process: function(dCfg,callback,logCmd) {
    if (dCfg) {
      var dTmp = {};
      Object.keys(dCfg).forEach( function(sKey) {
        var value = dCfg[sKey];
        if (sKey[0] !== ':') sKey = ':' + sKey;
        dTmp[sKey] = value;
      });
      dCfg = dTmp; 
    }
    else dCfg = {};
    
    var sAct = this.actName;
    if (sAct == 'GET') {
      var params = Object.assign({},this.params);
      
      // step 1: setup params.Key
      var attrValues = Object.assign({},this.attrValues,dCfg);
      params.Key = Object.assign({},params.Key);
      installRef(params.Key,attrValues);
      
      // step 2: setup config: capacity, consistent
      if (this.onConfig) {
        var d = adjustOnConfig(this.onConfig,dCfg);
        if (d.capacity) params.ReturnConsumedCapacity = d.capacity;
        if (d.consistent) params.ConsistentRead = !!d.consistent;
      }
      
      tryLogParam('get:',params);
      dynDC.get(params,callback || defaultCallback_);
    }
    else if (sAct == 'SELECT') {
      var params = Object.assign({},this.params);
      
      // step 1: setup params.ExpressionAttributeValues
      var attrValues = Object.assign({},this.attrValues,dCfg);
      var sTmp = (params.KeyConditionExpression || '') + ' ' + (params.FilterExpression || '');
      if (sTmp.length > 1 && clearNoUseVar(sTmp,attrValues))
        params.ExpressionAttributeValues = attrValues;
      
      // step 2: setup config: capacity, consistent, limit, last
      if (this.onConfig) {
        var d = adjustOnConfig(this.onConfig,dCfg);
        if (d.capacity) params.ReturnConsumedCapacity = d.capacity;
        if (d.consistent) params.ConsistentRead = !!d.consistent;
        if (d.limit) params.Limit = d.limit;
        if (d.last) params.ExclusiveStartKey = d.last; // from LastEvaluatedKey
      }
      
      tryLogParam('select:',params);
      dynDC.query(params,callback || defaultCallback_);
    }
    else if (sAct == 'SCAN') {
      var params = Object.assign({},this.params);
      
      // step 1: setup params.ExpressionAttributeValues
      var sTmp, attrValues = Object.assign({},this.attrValues,dCfg);
      if (sTmp = params.FilterExpression) {
        if (clearNoUseVar(sTmp,attrValues)) // has any variable // strict defined in dynamoDB
          params.ExpressionAttributeValues = attrValues;
      }
      
      // step 2: setup config: capacity, consistent, limit, last, segments, segment
      if (this.onConfig) {
        var d = adjustOnConfig(this.onConfig,dCfg);
        if (d.capacity) params.ReturnConsumedCapacity = d.capacity;
        if (d.consistent) params.ConsistentRead = !!d.consistent;
        if (d.limit) params.Limit = d.limit;
        if (d.last) params.ExclusiveStartKey = d.last; // from LastEvaluatedKey
        if (d.segments) params.TotalSegments = d.segments;
        if (d.segment) params.Segment = d.segment;
      }
      
      tryLogParam('scan:',params);
      dynDC.scan(params,callback || defaultCallback_);
    }
    else if (sAct == 'PUT') {
      var params = Object.assign({},this.params);
      var Item = params.Item;
      if (!Item) throw new Error('No item provided in PUT');
      
      // step 1: setup params.Item
      var attrValues = Object.assign({},this.attrValues,dCfg);
      Item = params.Item = Object.assign({},Item);
      installRef(Item,attrValues);
      
      // step 1: setup params.ExpressionAttributeValues
      var sTmp = params.ConditionExpression;
      if (sTmp && clearNoUseVar(sTmp,attrValues))  // has any variable
        params.ExpressionAttributeValues = attrValues;
      
      // step 3: setup config: capacity, return
      if (this.onConfig) {
        var d = adjustOnConfig(this.onConfig,dCfg);
        var sCapacity = d.capacity, sReturn = d['return'];
        if (sCapacity) params.ReturnConsumedCapacity = sCapacity;
        if (sReturn) params.ReturnValues = sReturn;
      }
      
      tryLogParam('put:',params);
      dynDC.put(params,callback || defaultCallback_);
    }
    else if (sAct == 'UPDATE') {
      var params = Object.assign({},this.params);
      
      // step 1: setup params.Key
      var attrValues = Object.assign({},this.attrValues,dCfg);
      params.Key = Object.assign({},params.Key);
      installRef(params.Key,attrValues);
      
      // step 2: setup params.ExpressionAttributeValues
      var sTmp = (params.ConditionExpression || '') + ' ' + (params.UpdateExpression || '');
      if (sTmp.length > 1 && clearNoUseVar(sTmp,attrValues)) // has any variable // strict defined in dynamoDB
        params.ExpressionAttributeValues = attrValues;
      
      // step 3: setup config: capacity, return
      if (this.onConfig) {
        var d = adjustOnConfig(this.onConfig,dCfg);
        var sCapacity = d.capacity, sReturn = d['return'];
        if (sCapacity) params.ReturnConsumedCapacity = sCapacity;
        if (sReturn) params.ReturnValues = sReturn;
      }
      
      tryLogParam('update:',params);
      dynDC.update(params,callback || defaultCallback_);
    }
    else if (sAct == 'DELETE') {
      var params = Object.assign({},this.params);
      
      // step 1: setup params.Key
      var attrValues = Object.assign({},this.attrValues,dCfg);
      params.Key = Object.assign({},params.Key);
      installRef(params.Key,attrValues);
      
      // step 2: setup params.ExpressionAttributeValues
      var sTmp = params.ConditionExpression;
      if (sTmp && clearNoUseVar(sTmp,attrValues)) // has any variable
        params.ExpressionAttributeValues = attrValues;
      
      // step 3: setup config: capacity, return
      if (this.onConfig) {
        var d = adjustOnConfig(this.onConfig,dCfg);
        var sCapacity = d.capacity, sReturn = d['return'];
        if (sCapacity) params.ReturnConsumedCapacity = sCapacity;
        if (sReturn) params.ReturnValues = sReturn;
      }
      
      tryLogParam('delete:',params);
      dynDC.delete(params,callback || defaultCallback_);
    }
    
    function clearNoUseVar(sExpr,attrValues) {
      var dVars = {}, hasAny = false;
      sExpr.replace(/:[_A-Za-z0-9]+/g, function(sKey) {
        dVars[sKey] = true;
      });
      Object.keys(attrValues).forEach( function(sKey) {
        if (!dVars[sKey])
          delete attrValues[sKey];
        else hasAny = true;
      });
      return hasAny;
    }
    
    function installRef(Item,attrValues) {
      Object.keys(Item).forEach( function(sKey) {
        var value = Item[sKey];
        if (typeof value == 'string' && value[0] == ':') {
          var refValue = attrValues[value];
          if (refValue !== undefined)
            Item[sKey] = refValue;
          else throw new Error('attribute (' + sKey + ') not defined!');
        }
      });
    }
    
    function adjustOnConfig(onConfig,dCfg) {
      var d = Object.assign({},onConfig), dValue = d[':value'] || {};
      delete d[':value'];
      Object.keys(d).forEach( function(sKey) {
        var sRef = d[sKey];
        if (typeof sRef == 'string' && sRef[0] == ':') {
          var value = dCfg[sRef];
          if (value === undefined) value = dValue[sRef];
          d[sKey] = value;
        }
      });
      return d;
    }
    
    function tryLogParam(sPrefix,params) {
      if (logCmd) console.log(sPrefix,JSON.stringify(params,null,2));
    }
  },
  
  log: function() {
    var d = { actName: this.actName,
      params: this.params,
      attrNames: this.attrNames,
      attrValues: this.attrValues,
      onConfig: this.onConfig,
    };
    console.log(JSON.stringify(d,null,2));
  },
};

dynSql.newSql = function(sSql) {
  var clause0, ast = yacc.setupAst(sSql,true);
  if (ast && (clause0 = ast[0]) && clause0[0] == 40) {
    var dClause = {};
    for (var i=1, item; item=ast[i]; i+=1) {
      dClause[item[1][1]] = item;
    }
    
    var params = {}, attrNames = {}, attrValues = {}, onConfig = null;
    var actClause = clause0[1], actType = actClause[0], actName = actClause[1][1];
    
    if (actType >= 21 && actType <= 23) {      // SELECT
      var tableExpr = actType == 21 || actType == 23? actClause[4]: actClause[6];
      var sTableName = getTableName_(tableExpr), isS3 = sTableName.indexOf('/') > 0;
      
      if (isS3) {
        // wait to do ...
      }
      else {
        // setup projection fields
        if (actType == 23) {
          var tmp = actClause[2];
          if (tmp[0] == 81 && (tmp=tmp[1][1])) // range_id should be 'ALL' or 'COUNT'
            params.Select = tmp == 'ALL'? 'ALL_ATTRIBUTES': 'COUNT';
        }
        else {
          var nameList = actType == 21? actClause[2]: actClause[3];
          var bName = scanNameList_(nameList,attrNames);
          if (bName.length)
            params.ProjectionExpression = bName.join(',');
        }
        
        // translate: BY
        var byClause = dClause.BY;
        if (byClause) {
          var byType = byClause[0];
          params.ScanIndexForward = true;  // default is true
          if (byType == 41)        // by_clause_1 : BY id
            params.IndexName = byClause[2][1];
          else if (byType == 42) { // by_clause_2 : BY id DESC
            params.IndexName = byClause[2][1];
            params.ScanIndexForward = false;
          }
          else params.ScanIndexForward = false; // by_clause_3 : BY DESC
        }
        
        // translate: WHERE
        var whereClause = dClause.WHERE;
        if (whereClause)
          params.KeyConditionExpression = setupCondition_(whereClause[2],attrNames,attrValues,true,0);
        
        // translate: FILTER
        var filterClause = dClause.FILTER;
        if (filterClause)
          params.FilterExpression = setupCondition_(filterClause[2],attrNames,attrValues,false,100);
        
        // translate: ON  // capacity, consistent, limit, last
        var onClause = dClause.ON;
        if (onClause) {
          var cfgValues = {};
          onConfig = {':value':cfgValues};
          setupOnList_(onConfig,{strIndex:500,numIndex:500},cfgValues,onClause[0] == 48? onClause[3]: onClause[2]);
        }
        
        params.TableName = sTableName;
        if (Object.keys(attrNames).length)
          params.ExpressionAttributeNames = attrNames;
        return new dynSql(actName,params,attrNames,attrValues,onConfig);
      }
    }
    
    else if (actType >= 24 && actType <= 26) { // GET
      var tableExpr = actType == 24 || actType == 26? actClause[4]: actClause[6];
      var sTableName = getTableName_(tableExpr), isS3 = sTableName.indexOf('/') > 0;
      
      if (isS3)
        throw new Error('Invalid table name (' + sTableName + ')');
      
      // setup projection fields
      if (actType == 26)  // ALL COUNT
        ;  // do nothing  // default is ALL
      else {
        var nameList = actType == 21? actClause[2]: actClause[3];
        var bName = scanNameList_(nameList,attrNames);
        if (bName.length)
          params.ProjectionExpression = bName.join(',');
      }
    
      // translate: WHEN
      var whenClause = dClause.WHEN;
      if (whenClause)
        params.Key = setupWhenKey_(whenClause[2],attrNames,attrValues,0);
      else throw new Error('no WHEN clause found');
      
      // translate: ON  // capacity, consistent
      var onClause = dClause.ON;
      if (onClause) {
        var cfgValues = {};
        onConfig = {':value':cfgValues};
        setupOnList_(onConfig,{strIndex:500,numIndex:500},cfgValues,onClause[0] == 48? onClause[3]: onClause[2]);
      }
      
      params.TableName = sTableName;
      if (Object.keys(attrNames).length)
        params.ExpressionAttributeNames = attrNames;
      return new dynSql(actName,params,attrNames,attrValues,onConfig);
    }
    
    else if (actType >= 27 && actType <= 29) { // SCAN
      var tableExpr = actType == 27 || actType == 29? actClause[4]: actClause[6];
      var sTableName = getTableName_(tableExpr), isS3 = sTableName.indexOf('/') > 0;
      
      if (isS3)
        throw new Error('Invalid table name (' + sTableName + ')');
      
      // setup projection fields
      if (actType == 29) {
        var tmp = actClause[2];
        if (tmp[0] == 81 && (tmp=tmp[1][1])) // range_id should be 'ALL' or 'COUNT'
          params.Select = tmp == 'ALL'? 'ALL_ATTRIBUTES': 'COUNT';
      }
      else {
        var nameList = actType == 21? actClause[2]: actClause[3];
        var bName = scanNameList_(nameList,attrNames);
        if (bName.length)
          params.ProjectionExpression = bName.join(',');
      }
      
      // translate: BY
      var byClause = dClause.BY;
      if (byClause) {  // SCAN should ignore DESC
        var byType = byClause[0];
        if (byType == 41)        // by_clause_1 : BY id
          params.IndexName = byClause[2][1];
        else if (byType == 42)   // by_clause_2 : BY id DESC
          params.IndexName = byClause[2][1];
        // else, ignore: BY DESC
      }
      
      // translate: FILTER
      var filterClause = dClause.FILTER;
      if (filterClause)
        params.FilterExpression = setupCondition_(filterClause[2],attrNames,attrValues,false,100);
      
      // translate: ON  // capacity, consistent, limit, last, segments, segment
      var onClause = dClause.ON;
      if (onClause) {
        var cfgValues = {};
        onConfig = {':value':cfgValues};
        setupOnList_(onConfig,{strIndex:500,numIndex:500},cfgValues,onClause[0] == 48? onClause[3]: onClause[2]);
      }
      
      params.TableName = sTableName;
      if (Object.keys(attrNames).length)
        params.ExpressionAttributeNames = attrNames;
      return new dynSql(actName,params,attrNames,attrValues,onConfig);
    }
    
    else if (actType == 30) { // PUT
      var sTableName = getTableName_(actClause[2]), isS3 = sTableName.indexOf('/') > 0;
      if (isS3) throw new Error('Invalid table name (' + sTableName + ')');
      
      // translate: SET
      var setClause = dClause.SET;
      if (setClause)
        params.Item = setupPutList_(setClause[0]==52?setClause[3]:setClause[2],attrNames,attrValues,200);
      else throw new Error('no SET clause found');
      
      // translate: WHERE
      var whereClause = dClause.WHERE;
      if (whereClause)
        params.ConditionExpression = setupCondition_(whereClause[2],attrNames,attrValues,false,100);
      
      // translate: ON  // capacity, return
      var onClause = dClause.ON;
      if (onClause) {
        var cfgValues = {};
        onConfig = {':value':cfgValues};
        setupOnList_(onConfig,{strIndex:500,numIndex:500},cfgValues,onClause[0] == 48? onClause[3]: onClause[2]);
      }
      
      params.TableName = sTableName;
      if (Object.keys(attrNames).length)
        params.ExpressionAttributeNames = attrNames;
      return new dynSql(actName,params,attrNames,attrValues,onConfig);
    }
    
    else if (actType == 31) { // UPDATE
      var sTableName = getTableName_(actClause[2]), isS3 = sTableName.indexOf('/') > 0;
      if (isS3) throw new Error('Invalid table name (' + sTableName + ')');
      
      // translate: WHEN
      var whenClause = dClause.WHEN;
      if (whenClause)
        params.Key = setupWhenKey_(whenClause[2],attrNames,attrValues,0);
      else throw new Error('no WHEN clause found');
      
      // translate: WHERE
      var whereClause = dClause.WHERE;
      if (whereClause)
        params.ConditionExpression = setupCondition_(whereClause[2],attrNames,attrValues,false,100);
      
      // translate: SET, RMV, ADD, DEL
      params.UpdateExpression = setupUpdateCmd_(dClause,attrNames,attrValues,200);
      
      // translate: ON  // capacity, return
      var onClause = dClause.ON;
      if (onClause) {
        var cfgValues = {};
        onConfig = {':value':cfgValues};
        setupOnList_(onConfig,{strIndex:500,numIndex:500},cfgValues,onClause[0] == 48? onClause[3]: onClause[2]);
      }
      
      params.TableName = sTableName;
      if (Object.keys(attrNames).length)
        params.ExpressionAttributeNames = attrNames;
      return new dynSql(actName,params,attrNames,attrValues,onConfig);
    }
    
    else if (actType == 32) { // DELETE
      var sTableName = getTableName_(actClause[3]), isS3 = sTableName.indexOf('/') > 0;
      if (isS3) throw new Error('Invalid table name (' + sTableName + ')');
      
      // translate: WHEN
      var whenClause = dClause.WHEN;
      if (whenClause)
        params.Key = setupWhenKey_(whenClause[2],attrNames,attrValues,0);
      else throw new Error('no WHEN clause found');
      
      // translate: WHERE
      var whereClause = dClause.WHERE;
      if (whereClause)
        params.ConditionExpression = setupCondition_(whereClause[2],attrNames,attrValues,false,100);
      
      // translate: ON  // capacity, return
      var onClause = dClause.ON;
      if (onClause) {
        var cfgValues = {};
        onConfig = {':value':cfgValues};
        setupOnList_(onConfig,{strIndex:500,numIndex:500},cfgValues,onClause[0] == 48? onClause[3]: onClause[2]);
      }
      
      params.TableName = sTableName;
      if (Object.keys(attrNames).length)
        params.ExpressionAttributeNames = attrNames;
      return new dynSql(actName,params,attrNames,attrValues,onConfig);
    }
  }
};

dynSql.init = function(AWS) {
  dynDC = new AWS.DynamoDB.DocumentClient();
  dynSql.newSet = dynDC.createSet; // dynSql.newSet([1,2])
};

module.exports = dynSql;
