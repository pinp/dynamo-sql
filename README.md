[（查看中文版 View in Chinese）](README_zh.md)

&nbsp;

### About dynamo-sql

dynamo-sql provides SQL like suite layer for AWS dynamoDB.

There are two goals we want to achieve for this DSL (Domain Specific Language) encapsulation, one is simplify programming, and another, make cross-vendor and cross-system migration easier.

&nbsp;

### SQL syntax

dynamo-sql supports following commands: GET, PUT, UPDATE, DELETE, SELECT, SCAN.

1）**GET: Use WHEN clause to denote primary key when fetching a record**

Example 1: get specific fields under the configure of ON clause.

``` sql
GET fieldA,fieldB,fieldC.memb FROM table_name WHEN fieldA=@fieldA AND fieldB=@fieldB ON consistent=TRUE
```

Example 2: get all fields.

``` sql
GET ALL FROM table_name WHEN fieldA=@fieldA AND fieldB=@fieldB ON consistent=TRUE
```

2）**PUT: Use SET clause to specify every field and commit a record**

All fields should list in SET clause, the PUT operation will overwrite old record if there has one.

Example 1: put a record.

``` sql
PUT table_name SET fieldA=@fieldA,fieldB=@fieldB,fieldC=@fileldC ON return="ALL_OLD"
```

Example 2: the record will be commited only when the condition in WHERE clause is satisfied.

``` sql
PUT table_name SET fieldA=@fieldA,fieldB=@fieldB,fieldC=@fileldC WHERE attribute_exists(fieldD)
```

3）**UPDATE: update a record**

Use SET clause to modify some fields, use ADD/DEL clause to add/delete a data set, use RMV clause to remove specific property, such as a field or member of array.

WHEN clause always used to denote primary key in UPDATE command, and it normally used for updating an existed record.

Example 1: update some fields.

``` sql
UPDATE table_name WHEN fieldA=@fieldA AND fieldB=@fieldB SET fieldC=fileldC+@count, fieldD=@fieldD ON return="ALL_OLD"
```

Example 2: remove property.

``` sql
UPDATE table_name WHEN fieldA=@fieldA AND fieldB=@fieldB RMV fieldE,fieldF[0] ON return="ALL_OLD"
```

Example 3: add or delete data set.

``` sql
UPDATE table_name WHEN fieldA=@fieldA AND fieldB=@fieldB ADD fieldG=@set1,fieldH.memb=@set2 DEL fieldH=@set3 ON return="ALL_NEW"
```

Example 4: update under condition.

``` sql
UPDATE table_name WHEN fieldA=@fieldA AND fieldB=@fieldB SET fieldC=fileldC+@count, fieldD=@fieldD WHERE fieldC<@count"
```

4）**DELETE: delete a record which primary key specified by WHEN clause**

Example:

``` sql
DELETE FROM table_name WHEN fieldA=@fieldA AND fieldB=@fieldB ON return="ALL_OLD"
```

5）**SELECT: query records by given primary key range in WHERE clause**

Example 1: query all fields.

``` sql
SELECT ALL FROM table_name WHERE fieldA=@fieldA AND fieldB>@fieldB ON limit=20
```

Example 2: query some fields.

``` sql
SELECT fieldA,fieldB,filedC FROM table_name WHERE fieldA=@fieldA AND fieldB>@fieldB ON limit=20
```

Example 3: add some filter condition.

``` sql
SELECT ALL FROM table_name WHERE fieldA=@fieldA AND fieldB>@fieldB FILTER fieldC=@fieldC
```

Example 4: by index.

``` sql
SELECT ALL FROM table_name BY index_name WHERE fieldA=@fieldA AND fieldB>@fieldB
```

Example 5: query in descend order.

``` sql
SELECT ALL FROM table_name BY index_name DESC WHERE fieldA=@fieldA AND fieldB>@fieldB
```

Or, use primary key with descend order.

``` sql
SELECT ALL FROM table_name BY DESC WHERE fieldA=@fieldA AND fieldB>@fieldB
```

Example 6: only return record number.

``` sql
SELECT COUNT FROM table_name BY index_name WHERE fieldA=@fieldA AND fieldB>@fieldB
```

6）**SCAN: scan records**

Example 1: scan under filter condition.

``` sql
SCAN ALL FROM table_name FILTER fieldC=@fieldC
```

Example 2: by index.

``` sql
SCAN fieldA,fieldB,fieldC FROM table_name BY index_name DESC ON last=@last,limit=20
```

&nbsp;

### Programming with API

1）**Install npm library**

``` bash
npm install --save aws-sdk
npm install --save dynamo-sql
```

2）**Import dynameDB SQL service layer**

``` js
var AWS = require('aws-sdk');
AWS.config.update({region:'us-west-2'});
AWS.config.apiVersion = '2012-08-10';

var dynSql = require('dynamo-sql');
dynSql.init(AWS);
```

3）**Create SQL service entity**

``` js
var sql = dynSql.newSql('UPDATE table_test WHEN sId="abcd" AND nTime=3 ADD mValue.aSet=@aSet ON return="ALL_NEW"');
sql.log();   // print intermediate information
```

4）**Run SQL**

``` js
sql.process({aSet:dynSql.newSet([1,2])}, function(err,data) {
  if (err) {
    console.log(err);
    return;
  }
  console.log(data);
}, true);  // logCmd=true means printing parameters of dynamoDB API
```

&nbsp;

### BSD License

Copyright 2017, PINP.ME Development Group. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:

  - Redistributions of source code must retain the above copyright
    notice, this list of conditions and the following disclaimer.
  - Redistributions in binary form must reproduce the above
    copyright notice, this list of conditions and the following
    disclaimer in the documentation and/or other materials provided
    with the distribution.
  - Neither the name of PINP.ME nor the names of its contributors 
    may be used to endorse or promote products derived from this 
    software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
