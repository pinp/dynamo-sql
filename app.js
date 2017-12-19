// app.js
// root module of project: dynamo-sql

var AWS = require('aws-sdk');
var dynSql = require('./dynamo');

AWS.config.update({region:'us-west-2'});
AWS.config.apiVersion = '2012-08-10';

dynSql.init(AWS);

var testSet = {};

testSet.test1 = function() {
  var sql = dynSql.newSql('PUT table_test SET sId="abcd",nTime=26,nValue=999,sValue="example3",mValue=@mValue ON return="ALL_OLD"');
  sql.log();
  
  sql.process({ ':mValue': {
    name: 'george',
    friends: ['a','b','c'],
    age: 20,
    aSet: dynSql.newSet([2,3,4]) }
  }, function(err,data) {
    if (err) {
      console.log(err);
      return;
    }
    console.log(data);
  },true);
};

testSet.test2 = function() {
  var sql;
  sql = dynSql.newSql('UPDATE table_test WHEN sId="abcd" AND nTime=26 DEL mValue.aSet=@aSet ON return="ALL_NEW"');
  sql.log();
  sql.process({aSet:dynSql.newSet([3])}, function(err,data) {
    if (err) {
      console.log(err);
      return;
    }
    console.log(data);
  },true);
};

/*
PUT table_test SET sId="abcd",nTime=25,nValue=1000,sValue="example"
PUT table_test SET sId="abcd",nTime=26,nValue=999,sValue="example2"
PUT table_test SET sId="abcd",nTime=27,nValue=998,sValue="example3"
PUT table_test SET sId="efgh",nTime=10,nValue=2000,sValue="none"
PUT table_test SET sId="abcd",nTime=26,nValue=999,sValue="example3" WHERE not_of(attribute_exists(mValue))

GET ALL FROM table_test WHEN sId="abcd" AND nTime=25
GET (sId,nTime,nValue,sValue,mValue) FROM table_test WHEN sId="abcd" AND nTime=26
GET (sId,nTime,nValue,sValue,mValue.friends,mValue.name) FROM table_test WHEN sId="abcd" AND nTime=26

SELECT COUNT FROM table_test WHERE sId="abcd"
SELECT ALL FROM table_test WHERE sId="abcd" ON limit=1
SELECT ALL FROM table_test BY sId_sValue_index WHERE sId="abcd" AND begins_with(sValue,"ex")
SELECT (sId,nTime,nValue,mValue) FROM table_test WHERE sId="abcd" AND nTime>=25 ON limit=1
SELECT (sId,nTime,nValue,mValue) FROM table_test WHERE sId="abcd" AND nTime>=25 FILTER attribute_exists(mValue) AND mValue.age=20

SELECT (sId,nTime,nValue,mValue) FROM table_test WHERE sId="abcd" AND nTime>=25 FILTER mValue.age=20

SCAN ALL FROM table_test
SCAN ALL FROM table_test ON limit=2
SCAN ALL FROM table_test FILTER mValue.age=20
SCAN (sId,nTime,nValue,mValue) FROM table_test FILTER mValue.age=20

UPDATE table_test WHEN sId="abcd" AND nTime=26 SET sValue="example5" ON return="ALL_NEW"
UPDATE table_test WHEN sId="abcd" AND nTime=26 ADD mValue.age=1 ON return="ALL_NEW"
UPDATE table_test WHEN sId="abcd" AND nTime=26 SET mValue.name="peter" ON return="ALL_NEW"

DELETE FROM table_test WHEN sId="efgh" AND nTime=10 ON return="ALL_OLD"
*/

// Command line environment
//-------------------------
var sql_prefix_ = { SELECT:true, GET:true, SCAN:true, 
  UPDATE:true, PUT:true, DELETE:true,
};

process.stdin.setEncoding('utf8');

process.stdin.on('readable', function() {
  var chunk = process.stdin.read();
  if (chunk !== null) {
    var sChunk = String(chunk);
    var sFunc = sChunk.split(/\W+/)[0];
    if (!sFunc) return;
    
    if (sql_prefix_[sFunc]) {  // direct run SQL command
      console.log('\n' + sChunk + '\n');
      var sql = dynSql.newSql(sChunk);
      sql.log();
      
      sql.process();
      process.stdout.write('\n>>> ');
      return;
    }
    
    var f = testSet[sFunc];
    if (typeof f == 'function') { // run test function: test1 test2
      var ret = f();
      if (ret !== undefined)
        process.stdout.write(String(ret) + '\n>>> ');
      else process.stdout.write('\n>>> ');
    }
  }
});

process.stdout.write('>>> ');
