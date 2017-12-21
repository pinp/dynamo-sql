[（View in English）](README.md)

&nbsp;

### 关于 dynamo-sql

本项目（dynamo-sql）对 AWS dynamoDB 做封装，提供类 SQL 语法实现常规数据库操作。

我们封装该 DSL（Domain Specific Language）脚本层是希望达成两个目标，一是简化开发，二是方便跨厂商、跨系统移植代码。

&nbsp;

### SQL 语法

dynamo-sql 支持 6 操作命令，包括：GET、PUT、UPDATE、DELETE、SELECT、SCAN。

[完整的 SQL 语法介绍请参考这篇文档](https://pinp.github.io/product-blogs/index.html?page=D171220-02.txt)

各种操作的使用规则如下：

1）**GET，用 WHEN 子句指明主键取得一条记录**

例句1，取指定字段，ON 子句用于指定配置：

``` sql
GET fieldA,fieldB,fieldC.memb FROM table_name WHEN fieldA=@fieldA AND fieldB=@fieldB ON consistent=TRUE
```

例句2，取所有字段：

``` sql
GET ALL FROM table_name WHEN fieldA=@fieldA AND fieldB=@fieldB ON consistent=TRUE
```

2）**PUT，用 SET 子句指定各字段取值来提交一条记录**

所指定的字段须包括主键，PUT 操作将覆盖原有记录，如果原记录存在的话。

例句1，提交一条记录：

``` sql
PUT table_name SET fieldA=@fieldA,fieldB=@fieldB,fieldC=@fileldC ON return="ALL_OLD"
```

例句2，WHERE 子句判断条件是否满足，条件满足才提交记录：

``` sql
PUT table_name SET fieldA=@fieldA,fieldB=@fieldB,fieldC=@fileldC WHERE attribute_exists(fieldD)
```

3）**UPDATE，更新指定记录**

用 SET 子句更新指定的字段，用 ADD 与 DEL 子句对指定集合做增、删，用 RMV 子句删除指定内容，比如删除字段或指定数组元素。

UPDATE 常用来更新已存在的记录，须用 WHEN 子句指定主键。

例句1，更新指定字段：

``` sql
UPDATE table_name WHEN fieldA=@fieldA AND fieldB=@fieldB SET fieldC=fileldC+@count, fieldD=@fieldD ON return="ALL_OLD"
```

例句2，删除指定内容：

``` sql
UPDATE table_name WHEN fieldA=@fieldA AND fieldB=@fieldB RMV fieldE,fieldF[0] ON return="ALL_OLD"
```

例句3，增删集合项目：

``` sql
UPDATE table_name WHEN fieldA=@fieldA AND fieldB=@fieldB ADD fieldG=@set1,fieldH.memb=@set2 DEL fieldH=@set3 ON return="ALL_NEW"
```

例句4，条件更新：

``` sql
UPDATE table_name WHEN fieldA=@fieldA AND fieldB=@fieldB SET fieldC=fileldC+@count, fieldD=@fieldD WHERE fieldC<@count"
```

4）**DELETE，删除由 WHEN 子句指定主键的记录**

例句：

``` sql
DELETE FROM table_name WHEN fieldA=@fieldA AND fieldB=@fieldB ON return="ALL_OLD"
```

5）**SELECT，查询符合条件的多条记录，由 WHERE 指定主键范围**

例句1，查询返回所有字段：

``` sql
SELECT ALL FROM table_name WHERE fieldA=@fieldA AND fieldB>@fieldB ON limit=20
```

例句2，查询返回指定字段：

``` sql
SELECT fieldA,fieldB,filedC FROM table_name WHERE fieldA=@fieldA AND fieldB>@fieldB ON limit=20
```

例句3，增加过滤条件：

``` sql
SELECT ALL FROM table_name WHERE fieldA=@fieldA AND fieldB>@fieldB FILTER fieldC=@fieldC
```

例句4，指定索引：

``` sql
SELECT ALL FROM table_name BY index_name WHERE fieldA=@fieldA AND fieldB>@fieldB
```

例句5，逆序查询：

``` sql
SELECT ALL FROM table_name BY index_name DESC WHERE fieldA=@fieldA AND fieldB>@fieldB
```

或使用主键逆序查询：

``` sql
SELECT ALL FROM table_name BY DESC WHERE fieldA=@fieldA AND fieldB>@fieldB
```

例句6，只返回记录数：

``` sql
SELECT COUNT FROM table_name BY index_name WHERE fieldA=@fieldA AND fieldB>@fieldB
```

6）**SCAN，遍历记录**

例句1，遍历并按指定条件过滤：

``` sql
SCAN ALL FROM table_name FILTER fieldC=@fieldC
```

例句2，指定索引：

``` sql
SCAN fieldA,fieldB,fieldC FROM table_name BY index_name DESC ON last=@last,limit=20
```

&nbsp;

### 使用 API

1）安装 npm 库

``` bash
npm install --save aws-sdk
npm install --save dynamo-sql
```

2）导入 SQL 服务层

``` js
var AWS = require('aws-sdk');
AWS.config.update({region:'us-west-2'});
AWS.config.apiVersion = '2012-08-10';

var dynSql = require('dynamo-sql');
dynSql.init(AWS);
```

3）创建 SQL 实体

``` js
var sql = dynSql.newSql('UPDATE table_test WHEN sId="abcd" AND nTime=3 ADD mValue.aSet=@aSet ON return="ALL_NEW"');
sql.log();   // print intermediate information
```

4）执行 SQL

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
