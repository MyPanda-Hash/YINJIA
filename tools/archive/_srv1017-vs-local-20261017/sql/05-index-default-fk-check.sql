SET NOCOUNT ON;
IF OBJECT_ID('tempdb..#srv') IS NOT NULL DROP TABLE #srv;
IF OBJECT_ID('tempdb..#loc') IS NOT NULL DROP TABLE #loc;
CREATE TABLE #srv (tbl nvarchar(300), cols nvarchar(max), incl nvarchar(max), type_desc nvarchar(60), is_unique bit);
CREATE TABLE #loc (tbl nvarchar(300), cols nvarchar(max), incl nvarchar(max), type_desc nvarchar(60), is_unique bit);

INSERT INTO #srv
SELECT SCHEMA_NAME(t.schema_id)+'.'+t.name,
  ISNULL(STUFF((SELECT ',' + c.name + CASE WHEN ic.is_descending_key=1 THEN ' D' ELSE ' A' END
                FROM HSDZ_MES_SRV1017.sys.index_columns ic JOIN HSDZ_MES_SRV1017.sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
                WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.is_included_column=0
                ORDER BY ic.key_ordinal, ic.column_id FOR XML PATH('')),1,1,''),''),
  ISNULL(STUFF((SELECT ',' + c.name FROM HSDZ_MES_SRV1017.sys.index_columns ic JOIN HSDZ_MES_SRV1017.sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
                WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.is_included_column=1
                ORDER BY ic.column_id FOR XML PATH('')),1,1,''),''),
  i.type_desc, i.is_unique
FROM HSDZ_MES_SRV1017.sys.indexes i JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id=i.object_id AND t.is_ms_shipped=0
WHERE i.type_desc <> 'HEAP' AND i.is_hypothetical=0;

INSERT INTO #loc
SELECT SCHEMA_NAME(t.schema_id)+'.'+t.name,
  ISNULL(STUFF((SELECT ',' + c.name + CASE WHEN ic.is_descending_key=1 THEN ' D' ELSE ' A' END
                FROM HSDZ_MES.sys.index_columns ic JOIN HSDZ_MES.sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
                WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.is_included_column=0
                ORDER BY ic.key_ordinal, ic.column_id FOR XML PATH('')),1,1,''),''),
  ISNULL(STUFF((SELECT ',' + c.name FROM HSDZ_MES.sys.index_columns ic JOIN HSDZ_MES.sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
                WHERE ic.object_id=i.object_id AND ic.index_id=i.index_id AND ic.is_included_column=1
                ORDER BY ic.column_id FOR XML PATH('')),1,1,''),''),
  i.type_desc, i.is_unique
FROM HSDZ_MES.sys.indexes i JOIN HSDZ_MES.sys.tables t ON t.object_id=i.object_id AND t.is_ms_shipped=0
WHERE i.type_desc <> 'HEAP' AND i.is_hypothetical=0;

PRINT '===== 1) 索引差异(忽略索引名) =====';
SELECT '仅本地' AS 归属, tbl AS 表, cols AS 键列, incl AS 包含列, type_desc AS 类型, is_unique AS 唯一 FROM #loc l
WHERE NOT EXISTS (SELECT 1 FROM #srv s WHERE s.tbl=l.tbl AND s.cols=l.cols AND s.incl=l.incl AND s.type_desc=l.type_desc AND s.is_unique=l.is_unique)
UNION ALL
SELECT '仅服务器', tbl, cols, incl, type_desc, is_unique FROM #srv s
WHERE NOT EXISTS (SELECT 1 FROM #loc l WHERE l.tbl=s.tbl AND l.cols=s.cols AND l.incl=s.incl AND l.type_desc=s.type_desc AND l.is_unique=s.is_unique);

PRINT '===== 2) 默认约束差异(表+列+定义) =====';
IF OBJECT_ID('tempdb..#dsrv') IS NOT NULL DROP TABLE #dsrv;
IF OBJECT_ID('tempdb..#dloc') IS NOT NULL DROP TABLE #dloc;
CREATE TABLE #dsrv (tbl nvarchar(300), col nvarchar(300), def nvarchar(max));
CREATE TABLE #dloc (tbl nvarchar(300), col nvarchar(300), def nvarchar(max));
INSERT INTO #dsrv SELECT SCHEMA_NAME(t.schema_id)+'.'+t.name, c.name, dc.definition
  FROM HSDZ_MES_SRV1017.sys.default_constraints dc
  JOIN HSDZ_MES_SRV1017.sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
  JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id=dc.parent_object_id;
INSERT INTO #dloc SELECT SCHEMA_NAME(t.schema_id)+'.'+t.name, c.name, dc.definition
  FROM HSDZ_MES.sys.default_constraints dc
  JOIN HSDZ_MES.sys.columns c ON c.object_id=dc.parent_object_id AND c.column_id=dc.parent_column_id
  JOIN HSDZ_MES.sys.tables t ON t.object_id=dc.parent_object_id;
SELECT '仅本地' AS 归属, tbl AS 表, col AS 列, def AS 默认值 FROM #dloc l
WHERE NOT EXISTS (SELECT 1 FROM #dsrv s WHERE s.tbl=l.tbl AND s.col=l.col AND s.def=l.def)
UNION ALL
SELECT '仅服务器', tbl, col, def FROM #dsrv s
WHERE NOT EXISTS (SELECT 1 FROM #dloc l WHERE l.tbl=s.tbl AND l.col=s.col AND l.def=s.def);

PRINT '===== 3) 外键差异 =====';
IF OBJECT_ID('tempdb..#fsrv') IS NOT NULL DROP TABLE #fsrv;
IF OBJECT_ID('tempdb..#floc') IS NOT NULL DROP TABLE #floc;
CREATE TABLE #fsrv (parent nvarchar(300), pcol nvarchar(300), ref nvarchar(300), rcol nvarchar(300));
CREATE TABLE #floc (parent nvarchar(300), pcol nvarchar(300), ref nvarchar(300), rcol nvarchar(300));
INSERT INTO #fsrv SELECT SCHEMA_NAME(t.schema_id)+'.'+t.name, pc.name, SCHEMA_NAME(rt.schema_id)+'.'+rt.name, rc.name
  FROM HSDZ_MES_SRV1017.sys.foreign_keys fk
  JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id=fk.parent_object_id
  JOIN HSDZ_MES_SRV1017.sys.tables rt ON rt.object_id=fk.referenced_object_id
  JOIN HSDZ_MES_SRV1017.sys.foreign_key_columns fkc ON fkc.constraint_object_id=fk.object_id
  JOIN HSDZ_MES_SRV1017.sys.columns pc ON pc.object_id=fkc.parent_object_id AND pc.column_id=fkc.parent_column_id
  JOIN HSDZ_MES_SRV1017.sys.columns rc ON rc.object_id=fkc.referenced_object_id AND rc.column_id=fkc.referenced_column_id;
INSERT INTO #floc SELECT SCHEMA_NAME(t.schema_id)+'.'+t.name, pc.name, SCHEMA_NAME(rt.schema_id)+'.'+rt.name, rc.name
  FROM HSDZ_MES.sys.foreign_keys fk
  JOIN HSDZ_MES.sys.tables t ON t.object_id=fk.parent_object_id
  JOIN HSDZ_MES.sys.tables rt ON rt.object_id=fk.referenced_object_id
  JOIN HSDZ_MES.sys.foreign_key_columns fkc ON fkc.constraint_object_id=fk.object_id
  JOIN HSDZ_MES.sys.columns pc ON pc.object_id=fkc.parent_object_id AND pc.column_id=fkc.parent_column_id
  JOIN HSDZ_MES.sys.columns rc ON rc.object_id=fkc.referenced_object_id AND rc.column_id=fkc.referenced_column_id;
SELECT '仅本地' AS 归属, * FROM #floc l
WHERE NOT EXISTS (SELECT 1 FROM #fsrv s WHERE s.parent=l.parent AND s.pcol=l.pcol AND s.ref=l.ref AND s.rcol=l.rcol)
UNION ALL
SELECT '仅服务器', * FROM #fsrv s
WHERE NOT EXISTS (SELECT 1 FROM #floc l WHERE l.parent=s.parent AND l.pcol=s.pcol AND l.ref=s.ref AND l.rcol=s.rcol);
SELECT COUNT(*) AS 外键总数_本地 FROM #floc;
SELECT COUNT(*) AS 外键总数_服务器 FROM #fsrv;

PRINT '===== 4) CHECK 约束差异 =====';
SELECT '仅本地' AS 归属, t.name AS 表, cc.definition AS 定义
FROM HSDZ_MES.sys.check_constraints cc JOIN HSDZ_MES.sys.tables t ON t.object_id=cc.parent_object_id
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES_SRV1017.sys.check_constraints r JOIN HSDZ_MES_SRV1017.sys.tables rt ON rt.object_id=r.parent_object_id
                  WHERE rt.name=t.name AND r.definition=cc.definition)
UNION ALL
SELECT '仅服务器', t.name, cc.definition
FROM HSDZ_MES_SRV1017.sys.check_constraints cc JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id=cc.parent_object_id
WHERE NOT EXISTS (SELECT 1 FROM HSDZ_MES.sys.check_constraints r JOIN HSDZ_MES.sys.tables rt ON rt.object_id=r.parent_object_id
                  WHERE rt.name=t.name AND r.definition=cc.definition);

PRINT '===== 5) 存储过程/触发器/函数 =====';
SELECT 'LOC' AS 归属, SCHEMA_NAME(schema_id)+'.'+name AS 对象, type_desc FROM HSDZ_MES.sys.objects WHERE type IN ('P','FN','IF','TF','TR') AND is_ms_shipped=0
UNION ALL SELECT 'SRV', SCHEMA_NAME(schema_id)+'.'+name, type_desc FROM HSDZ_MES_SRV1017.sys.objects WHERE type IN ('P','FN','IF','TF','TR') AND is_ms_shipped=0;
