SET NOCOUNT ON;
PRINT '=== 1) 约束按类型清点(服务器 SRV1017 / 本地 HSDZ_MES) ===';
SELECT 'PK' AS 类型,
  (SELECT COUNT(*) FROM HSDZ_MES_SRV1017.sys.key_constraints WHERE type='PK') AS 服务器,
  (SELECT COUNT(*) FROM HSDZ_MES.sys.key_constraints WHERE type='PK') AS 本地
UNION ALL SELECT 'UQ(唯一约束)',
  (SELECT COUNT(*) FROM HSDZ_MES_SRV1017.sys.key_constraints WHERE type='UQ'),
  (SELECT COUNT(*) FROM HSDZ_MES.sys.key_constraints WHERE type='UQ')
UNION ALL SELECT 'CK(检查约束)',
  (SELECT COUNT(*) FROM HSDZ_MES_SRV1017.sys.check_constraints),
  (SELECT COUNT(*) FROM HSDZ_MES.sys.check_constraints)
UNION ALL SELECT 'DF(默认约束)',
  (SELECT COUNT(*) FROM HSDZ_MES_SRV1017.sys.default_constraints),
  (SELECT COUNT(*) FROM HSDZ_MES.sys.default_constraints)
UNION ALL SELECT 'FK(外键)',
  (SELECT COUNT(*) FROM HSDZ_MES_SRV1017.sys.foreign_keys),
  (SELECT COUNT(*) FROM HSDZ_MES.sys.foreign_keys)
UNION ALL SELECT '唯一索引(非约束)',
  (SELECT COUNT(*) FROM HSDZ_MES_SRV1017.sys.indexes WHERE is_unique=1 AND is_unique_constraint=0 AND is_primary_key=0 AND type_desc<>'HEAP'),
  (SELECT COUNT(*) FROM HSDZ_MES.sys.indexes WHERE is_unique=1 AND is_unique_constraint=0 AND is_primary_key=0 AND type_desc<>'HEAP')
UNION ALL SELECT '全部索引(非堆)',
  (SELECT COUNT(*) FROM HSDZ_MES_SRV1017.sys.indexes i JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id=i.object_id AND t.is_ms_shipped=0 WHERE i.type_desc<>'HEAP'),
  (SELECT COUNT(*) FROM HSDZ_MES.sys.indexes i JOIN HSDZ_MES.sys.tables t ON t.object_id=i.object_id AND t.is_ms_shipped=0 WHERE i.type_desc<>'HEAP');

PRINT '=== 2) 显式命名(is_system_named=0)的约束:按「名称+所属表」双向比 ===';
IF OBJECT_ID('tempdb..#ns') IS NOT NULL DROP TABLE #ns;
IF OBJECT_ID('tempdb..#nl') IS NOT NULL DROP TABLE #nl;
CREATE TABLE #ns (k nvarchar(600));
CREATE TABLE #nl (k nvarchar(600));
INSERT INTO #ns SELECT CONCAT('CK|', t.name, '|', cc.name) FROM HSDZ_MES_SRV1017.sys.check_constraints cc
  JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id=cc.parent_object_id WHERE cc.is_system_named=0
UNION ALL SELECT CONCAT('DF|', t.name, '|', dc.name) FROM HSDZ_MES_SRV1017.sys.default_constraints dc
  JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id=dc.parent_object_id WHERE dc.is_system_named=0
UNION ALL SELECT CONCAT(kc.type, '|', t.name, '|', kc.name) FROM HSDZ_MES_SRV1017.sys.key_constraints kc
  JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id=kc.parent_object_id WHERE kc.is_system_named=0
UNION ALL SELECT CONCAT('FK|', t.name, '|', fk.name) FROM HSDZ_MES_SRV1017.sys.foreign_keys fk
  JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id=fk.parent_object_id;
INSERT INTO #nl SELECT CONCAT('CK|', t.name, '|', cc.name) FROM HSDZ_MES.sys.check_constraints cc
  JOIN HSDZ_MES.sys.tables t ON t.object_id=cc.parent_object_id WHERE cc.is_system_named=0
UNION ALL SELECT CONCAT('DF|', t.name, '|', dc.name) FROM HSDZ_MES.sys.default_constraints dc
  JOIN HSDZ_MES.sys.tables t ON t.object_id=dc.parent_object_id WHERE dc.is_system_named=0
UNION ALL SELECT CONCAT(kc.type, '|', t.name, '|', kc.name) FROM HSDZ_MES.sys.key_constraints kc
  JOIN HSDZ_MES.sys.tables t ON t.object_id=kc.parent_object_id WHERE kc.is_system_named=0
UNION ALL SELECT CONCAT('FK|', t.name, '|', fk.name) FROM HSDZ_MES.sys.foreign_keys fk
  JOIN HSDZ_MES.sys.tables t ON t.object_id=fk.parent_object_id;
SELECT '显式命名约束:服务器独有' AS 项, COUNT(*) AS 条数 FROM (SELECT k FROM #ns EXCEPT SELECT k FROM #nl) x
UNION ALL SELECT '显式命名约束:本地独有', COUNT(*) FROM (SELECT k FROM #nl EXCEPT SELECT k FROM #ns) y;
SELECT '服务器独有' AS 归属, k FROM #ns WHERE NOT EXISTS (SELECT 1 FROM #nl WHERE nl.k=ns.k)
UNION ALL SELECT '本地独有', k FROM #nl WHERE NOT EXISTS (SELECT 1 FROM #ns WHERE ns.k=nl.k);

PRINT '=== 3) 索引名称(排除自动生成 PK/UQ 索引名):双向比 ===';
IF OBJECT_ID('tempdb..#is') IS NOT NULL DROP TABLE #is;
IF OBJECT_ID('tempdb..#il') IS NOT NULL DROP TABLE #il;
CREATE TABLE #is (k nvarchar(600)); CREATE TABLE #il (k nvarchar(600));
INSERT INTO #is SELECT CONCAT(t.name,'|',i.name) FROM HSDZ_MES_SRV1017.sys.indexes i
  JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id=i.object_id AND t.is_ms_shipped=0 WHERE i.type_desc<>'HEAP';
INSERT INTO #il SELECT CONCAT(t.name,'|',i.name) FROM HSDZ_MES.sys.indexes i
  JOIN HSDZ_MES.sys.tables t ON t.object_id=i.object_id AND t.is_ms_shipped=0 WHERE i.type_desc<>'HEAP';
SELECT '索引名:服务器独有' AS 项, COUNT(*) AS 条数 FROM (SELECT k FROM #is EXCEPT SELECT k FROM #il) x
UNION ALL SELECT '索引名:本地独有', COUNT(*) FROM (SELECT k FROM #il EXCEPT SELECT k FROM #is) y;

PRINT '=== 4) 扩展属性 MS_Description(表/列中文注明)数量 + 双向差异 ===';
SELECT '表级 MS_Description' AS 项,
  (SELECT COUNT(*) FROM HSDZ_MES_SRV1017.sys.extended_properties WHERE minor_id=0 AND name='MS_Description') AS 服务器,
  (SELECT COUNT(*) FROM HSDZ_MES.sys.extended_properties WHERE minor_id=0 AND name='MS_Description') AS 本地
UNION ALL SELECT '列级 MS_Description',
  (SELECT COUNT(*) FROM HSDZ_MES_SRV1017.sys.extended_properties WHERE minor_id>0 AND name='MS_Description'),
  (SELECT COUNT(*) FROM HSDZ_MES.sys.extended_properties WHERE minor_id>0 AND name='MS_Description');
IF OBJECT_ID('tempdb..#es') IS NOT NULL DROP TABLE #es;
IF OBJECT_ID('tempdb..#el') IS NOT NULL DROP TABLE #el;
CREATE TABLE #es (k nvarchar(1000)); CREATE TABLE #el (k nvarchar(1000));
INSERT INTO #es SELECT CONCAT(OBJECT_SCHEMA_NAME(ep.major_id),'.',OBJECT_NAME(ep.major_id),'.',ISNULL(COL_NAME(ep.major_id,ep.minor_id),''),'=',CONVERT(nvarchar(400),ep.value))
  FROM HSDZ_MES_SRV1017.sys.extended_properties ep WHERE ep.name='MS_Description';
INSERT INTO #el SELECT CONCAT(OBJECT_SCHEMA_NAME(ep.major_id),'.',OBJECT_NAME(ep.major_id),'.',ISNULL(COL_NAME(ep.major_id,ep.minor_id),''),'=',CONVERT(nvarchar(400),ep.value))
  FROM HSDZ_MES.sys.extended_properties ep WHERE ep.name='MS_Description';
SELECT '扩展属性:服务器独有' AS 项, COUNT(*) AS 条数 FROM (SELECT k FROM #es EXCEPT SELECT k FROM #el) x
UNION ALL SELECT '扩展属性:本地独有', COUNT(*) FROM (SELECT k FROM #el EXCEPT SELECT k FROM #es) y;
