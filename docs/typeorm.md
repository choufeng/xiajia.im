# TypeORM

## Repository API list

```
const manager = respository.manager;

```

- manager
- metadata
- queryRunner
- target
- createQueryBuilder
- hasId
- getId
- create
- merge
- preload
- save
- remove
- insert
- update
- delete
- count
- increment
- decrement
- find
- findAndCount
- findByIds
- findOne
- findOneOrFail
- query
- clear

## TreeRepository API
|Function| notes|
|---|---|
|findTrees | 返回所有树，包括子节点，字节点的子节点..|
|findRoots| 返回所有根节点|
|findDescendants| 返回某节点的所有字节点(一维数组)|
|findDescendantsTree| 返回某节点的字节点树|
|createDescendantsQueryBuilder| 创建一个树子节点的查询构建器|
|countDescendants| 返回某节点的子节点数|
|findAncestors| 返回给定节点的所有父节点（一维数组）|
|findAncestorsTree| 返回给定节点的所有父节点数结构|
|createAncestorsQueryBuilder| 创建一个树富姐点的查询构建器|
|countAncestors| 返回某节点的所有父节点数|


## EntityManager API

- queryRunner
- transaction
- query
- createQueryBuilder
- hasId
- getId
- create
- merge
- preload
- save
- update
- insert
- update
- delete
- count
- increment
- decrement
- find
- findAndCount
- findByIds
- findOne
- findOneOrFail
- clear
- getRepository
- getTreeRepository
- getCustomRepository
- release