/* ============================================================================
   24-structural-fingerprint-all.sql
   目的:把「本地 HSDZ_MES」与「服务器快照 HSDZ_MES_SRV1017」的**全部表结构事实**
   做成可比对的字符串集合,逐条双向比,再按表做指纹比对 —— 用来回答
   「所有表和服务器快照的结构是否完全一致」。

   覆盖的结构事实(每行一个事实,双向 EXCEPT):
     COL   列:表.列 | 类型 | 长度 | 精度 | 小数位 | 可空 | 标识 | seed | increment |
               排序规则 | 默认值 | 计算列表达式 | 是否持久化 | rowguidcol | sparse | column_set
     IDX   索引/主键/唯一索引:表 | 名字 | 类型 | 唯一 | 主键 | 唯一约束 | 键列(含升降序) |
               包含列 | 筛选条件 | 是否禁用 | 填充因子
     PKUQ  主键/唯一约束:表 | 名字 | 类型 | 列
     CK    检查约束:表 | 名字 | 定义 | 是否禁用 | 是否可信
     DF    默认约束:表 | 名字 | 列 | 定义 | 是否系统命名
     TRG   触发器:表 | 名字 | 定义哈希 | 是否禁用 | 是否 INSTEAD OF
     VIEW  视图:名字 | 定义哈希 | 是否 SCHEMABINDING
     STAT  用户统计:表 | 名字 | 列 | 筛选
     XPROP 扩展属性(MS_Description 等):类 | 对象 | 列 | 名字 | 取值
   兼容级别 100 ⇒ 不用 STRING_AGG(用 FOR XML PATH)。
   ============================================================================ */
SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID('tempdb..#srv') IS NOT NULL DROP TABLE #srv;
IF OBJECT_ID('tempdb..#loc') IS NOT NULL DROP TABLE #loc;
CREATE TABLE #srv (cat varchar(8), tbl nvarchar(300), k nvarchar(max));
CREATE TABLE #loc (cat varchar(8), tbl nvarchar(300), k nvarchar(max));

/* ---------------- A) 列(含全部属性) ---------------- */
INSERT INTO #srv (cat, tbl, k)
SELECT 'COL',
       SCHEMA_NAME(t.schema_id) + '.' + t.name,
       CONCAT(SCHEMA_NAME(t.schema_id), '.', t.name, '.', c.name, '|',
              TYPE_NAME(c.user_type_id), '|', c.max_length, '|', c.precision, '|', c.scale, '|',
              c.is_nullable, '|', c.is_identity, '|',
              ISNULL(CONVERT(varchar(30), ic.seed_value), '-'), '|',
              ISNULL(CONVERT(varchar(30), ic.increment_value), '-'), '|',
              ISNULL(c.collation_name, '-'), '|',
              ISNULL(dc.definition, '-'), '|',
              ISNULL(cc.definition, '-'), '|', ISNULL(cc.is_persisted, 0), '|',
              c.is_rowguidcol, '|', ISNULL(c.is_sparse, 0), '|', ISNULL(c.is_column_set, 0))
FROM HSDZ_MES_SRV1017.sys.tables t
JOIN HSDZ_MES_SRV1017.sys.columns c ON c.object_id = t.object_id
LEFT JOIN HSDZ_MES_SRV1017.sys.identity_columns ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id
LEFT JOIN HSDZ_MES_SRV1017.sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
LEFT JOIN HSDZ_MES_SRV1017.sys.computed_columns cc ON cc.object_id = c.object_id AND cc.column_id = c.column_id
WHERE t.is_ms_shipped = 0;

INSERT INTO #loc (cat, tbl, k)
SELECT 'COL',
       SCHEMA_NAME(t.schema_id) + '.' + t.name,
       CONCAT(SCHEMA_NAME(t.schema_id), '.', t.name, '.', c.name, '|',
              TYPE_NAME(c.user_type_id), '|', c.max_length, '|', c.precision, '|', c.scale, '|',
              c.is_nullable, '|', c.is_identity, '|',
              ISNULL(CONVERT(varchar(30), ic.seed_value), '-'), '|',
              ISNULL(CONVERT(varchar(30), ic.increment_value), '-'), '|',
              ISNULL(c.collation_name, '-'), '|',
              ISNULL(dc.definition, '-'), '|',
              ISNULL(cc.definition, '-'), '|', ISNULL(cc.is_persisted, 0), '|',
              c.is_rowguidcol, '|', ISNULL(c.is_sparse, 0), '|', ISNULL(c.is_column_set, 0))
FROM HSDZ_MES.sys.tables t
JOIN HSDZ_MES.sys.columns c ON c.object_id = t.object_id
LEFT JOIN HSDZ_MES.sys.identity_columns ic ON ic.object_id = c.object_id AND ic.column_id = c.column_id
LEFT JOIN HSDZ_MES.sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
LEFT JOIN HSDZ_MES.sys.computed_columns cc ON cc.object_id = c.object_id AND cc.column_id = c.column_id
WHERE t.is_ms_shipped = 0;

/* ---------------- B) 索引 ---------------- */
INSERT INTO #srv (cat, tbl, k)
SELECT 'IDX', SCHEMA_NAME(t.schema_id) + '.' + t.name,
       CONCAT(SCHEMA_NAME(t.schema_id), '.', t.name, '|', i.name, '|', i.type_desc, '|', i.is_unique, '|',
              i.is_primary_key, '|', i.is_unique_constraint, '|',
              ISNULL(STUFF((SELECT ',' + c.name + CASE WHEN ic.is_descending_key = 1 THEN ':D' ELSE ':A' END
                             FROM HSDZ_MES_SRV1017.sys.index_columns ic
                             JOIN HSDZ_MES_SRV1017.sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                             WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
                             ORDER BY ic.key_ordinal, ic.column_id FOR XML PATH('')), 1, 1, ''), '-'), '|',
              ISNULL(STUFF((SELECT ',' + c.name
                             FROM HSDZ_MES_SRV1017.sys.index_columns ic
                             JOIN HSDZ_MES_SRV1017.sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                             WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 1
                             ORDER BY ic.column_id FOR XML PATH('')), 1, 1, ''), '-'), '|',
              ISNULL(i.filter_definition, '-'), '|', i.is_disabled, '|', ISNULL(i.fill_factor, 0))
FROM HSDZ_MES_SRV1017.sys.indexes i
JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id = i.object_id
WHERE t.is_ms_shipped = 0 AND i.type_desc <> 'HEAP' AND i.is_hypothetical = 0;

INSERT INTO #loc (cat, tbl, k)
SELECT 'IDX', SCHEMA_NAME(t.schema_id) + '.' + t.name,
       CONCAT(SCHEMA_NAME(t.schema_id), '.', t.name, '|', i.name, '|', i.type_desc, '|', i.is_unique, '|',
              i.is_primary_key, '|', i.is_unique_constraint, '|',
              ISNULL(STUFF((SELECT ',' + c.name + CASE WHEN ic.is_descending_key = 1 THEN ':D' ELSE ':A' END
                             FROM HSDZ_MES.sys.index_columns ic
                             JOIN HSDZ_MES.sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                             WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
                             ORDER BY ic.key_ordinal, ic.column_id FOR XML PATH('')), 1, 1, ''), '-'), '|',
              ISNULL(STUFF((SELECT ',' + c.name
                             FROM HSDZ_MES.sys.index_columns ic
                             JOIN HSDZ_MES.sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                             WHERE ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 1
                             ORDER BY ic.column_id FOR XML PATH('')), 1, 1, ''), '-'), '|',
              ISNULL(i.filter_definition, '-'), '|', i.is_disabled, '|', ISNULL(i.fill_factor, 0))
FROM HSDZ_MES.sys.indexes i
JOIN HSDZ_MES.sys.tables t ON t.object_id = i.object_id
WHERE t.is_ms_shipped = 0 AND i.type_desc <> 'HEAP' AND i.is_hypothetical = 0;

/* ---------------- C) 主键 / 唯一约束 ---------------- */
INSERT INTO #srv (cat, tbl, k)
SELECT 'PKUQ', SCHEMA_NAME(t.schema_id) + '.' + t.name,
       CONCAT(SCHEMA_NAME(t.schema_id), '.', t.name, '|', kc.name, '|', kc.type, '|',
              ISNULL(STUFF((SELECT ',' + c.name FROM HSDZ_MES_SRV1017.sys.index_columns ic
                             JOIN HSDZ_MES_SRV1017.sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                             WHERE ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
                             ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, ''), '-'))
FROM HSDZ_MES_SRV1017.sys.key_constraints kc
JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id = kc.parent_object_id
WHERE t.is_ms_shipped = 0;

INSERT INTO #loc (cat, tbl, k)
SELECT 'PKUQ', SCHEMA_NAME(t.schema_id) + '.' + t.name,
       CONCAT(SCHEMA_NAME(t.schema_id), '.', t.name, '|', kc.name, '|', kc.type, '|',
              ISNULL(STUFF((SELECT ',' + c.name FROM HSDZ_MES.sys.index_columns ic
                             JOIN HSDZ_MES.sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                             WHERE ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
                             ORDER BY ic.key_ordinal FOR XML PATH('')), 1, 1, ''), '-'))
FROM HSDZ_MES.sys.key_constraints kc
JOIN HSDZ_MES.sys.tables t ON t.object_id = kc.parent_object_id
WHERE t.is_ms_shipped = 0;

/* ---------------- D) CHECK 约束 ---------------- */
INSERT INTO #srv (cat, tbl, k)
SELECT 'CK', SCHEMA_NAME(t.schema_id) + '.' + t.name,
       CONCAT(SCHEMA_NAME(t.schema_id), '.', t.name, '|', cc.name, '|', ISNULL(cc.definition, '-'), '|',
              cc.is_disabled, '|', cc.is_not_trusted)
FROM HSDZ_MES_SRV1017.sys.check_constraints cc
JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id = cc.parent_object_id;

INSERT INTO #loc (cat, tbl, k)
SELECT 'CK', SCHEMA_NAME(t.schema_id) + '.' + t.name,
       CONCAT(SCHEMA_NAME(t.schema_id), '.', t.name, '|', cc.name, '|', ISNULL(cc.definition, '-'), '|',
              cc.is_disabled, '|', cc.is_not_trusted)
FROM HSDZ_MES.sys.check_constraints cc
JOIN HSDZ_MES.sys.tables t ON t.object_id = cc.parent_object_id;

/* ---------------- E) 默认约束(单列出来,因为它是最容易有差异的一类) ---------------- */
INSERT INTO #srv (cat, tbl, k)
SELECT 'DF', SCHEMA_NAME(t.schema_id) + '.' + t.name,
       CONCAT(SCHEMA_NAME(t.schema_id), '.', t.name, '|', dc.name, '|', c.name, '|',
              ISNULL(dc.definition, '-'), '|', dc.is_system_named)
FROM HSDZ_MES_SRV1017.sys.default_constraints dc
JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id = dc.parent_object_id
JOIN HSDZ_MES_SRV1017.sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id;

INSERT INTO #loc (cat, tbl, k)
SELECT 'DF', SCHEMA_NAME(t.schema_id) + '.' + t.name,
       CONCAT(SCHEMA_NAME(t.schema_id), '.', t.name, '|', dc.name, '|', c.name, '|',
              ISNULL(dc.definition, '-'), '|', dc.is_system_named)
FROM HSDZ_MES.sys.default_constraints dc
JOIN HSDZ_MES.sys.tables t ON t.object_id = dc.parent_object_id
JOIN HSDZ_MES.sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id;

/* ---------------- F) 触发器 ---------------- */
INSERT INTO #srv (cat, tbl, k)
SELECT 'TRG', ISNULL(SCHEMA_NAME(t.schema_id) + '.' + t.name, '-'),
       CONCAT(OBJECT_SCHEMA_NAME(tr.object_id), '.', tr.name, '|',
              CONVERT(varchar(32), HASHBYTES('MD5', ISNULL(m.definition, '')), 2), '|',
              tr.is_disabled, '|', tr.is_instead_of_trigger)
FROM HSDZ_MES_SRV1017.sys.triggers tr
LEFT JOIN HSDZ_MES_SRV1017.sys.sql_modules m ON m.object_id = tr.object_id
LEFT JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id = tr.parent_id;

INSERT INTO #loc (cat, tbl, k)
SELECT 'TRG', ISNULL(SCHEMA_NAME(t.schema_id) + '.' + t.name, '-'),
       CONCAT(OBJECT_SCHEMA_NAME(tr.object_id), '.', tr.name, '|',
              CONVERT(varchar(32), HASHBYTES('MD5', ISNULL(m.definition, '')), 2), '|',
              tr.is_disabled, '|', tr.is_instead_of_trigger)
FROM HSDZ_MES.sys.triggers tr
LEFT JOIN HSDZ_MES.sys.sql_modules m ON m.object_id = tr.object_id
LEFT JOIN HSDZ_MES.sys.tables t ON t.object_id = tr.parent_id;

/* ---------------- G) 视图 ---------------- */
INSERT INTO #srv (cat, tbl, k)
SELECT 'VIEW', '(view)',
       CONCAT(SCHEMA_NAME(v.schema_id), '.', v.name, '|',
              CONVERT(varchar(32), HASHBYTES('MD5', ISNULL(m.definition, '')), 2), '|',
              ISNULL(m.is_schema_bound,0), '|', (SELECT COUNT(*) FROM HSDZ_MES_SRV1017.sys.columns c WHERE c.object_id = v.object_id))
FROM HSDZ_MES_SRV1017.sys.views v
LEFT JOIN HSDZ_MES_SRV1017.sys.sql_modules m ON m.object_id = v.object_id
WHERE v.is_ms_shipped = 0;

INSERT INTO #loc (cat, tbl, k)
SELECT 'VIEW', '(view)',
       CONCAT(SCHEMA_NAME(v.schema_id), '.', v.name, '|',
              CONVERT(varchar(32), HASHBYTES('MD5', ISNULL(m.definition, '')), 2), '|',
              ISNULL(m.is_schema_bound,0), '|', (SELECT COUNT(*) FROM HSDZ_MES.sys.columns c WHERE c.object_id = v.object_id))
FROM HSDZ_MES.sys.views v
LEFT JOIN HSDZ_MES.sys.sql_modules m ON m.object_id = v.object_id
WHERE v.is_ms_shipped = 0;

/* ---------------- H) 用户统计 ---------------- */
INSERT INTO #srv (cat, tbl, k)
SELECT 'STAT', ISNULL(SCHEMA_NAME(t.schema_id) + '.' + t.name, '-'),
       CONCAT(ISNULL(SCHEMA_NAME(t.schema_id) + '.' + t.name, '-'), '|', st.name, '|',
              ISNULL(STUFF((SELECT ',' + c.name FROM HSDZ_MES_SRV1017.sys.stats_columns sc
                             JOIN HSDZ_MES_SRV1017.sys.columns c ON c.object_id = sc.object_id AND c.column_id = sc.column_id
                             WHERE sc.object_id = st.object_id AND sc.stats_id = st.stats_id
                             ORDER BY sc.stats_column_id FOR XML PATH('')), 1, 1, ''), '-'), '|',
              ISNULL(st.filter_definition, '-'))
FROM HSDZ_MES_SRV1017.sys.stats st
LEFT JOIN HSDZ_MES_SRV1017.sys.tables t ON t.object_id = st.object_id
WHERE st.user_created = 1;

INSERT INTO #loc (cat, tbl, k)
SELECT 'STAT', ISNULL(SCHEMA_NAME(t.schema_id) + '.' + t.name, '-'),
       CONCAT(ISNULL(SCHEMA_NAME(t.schema_id) + '.' + t.name, '-'), '|', st.name, '|',
              ISNULL(STUFF((SELECT ',' + c.name FROM HSDZ_MES.sys.stats_columns sc
                             JOIN HSDZ_MES.sys.columns c ON c.object_id = sc.object_id AND c.column_id = sc.column_id
                             WHERE sc.object_id = st.object_id AND sc.stats_id = st.stats_id
                             ORDER BY sc.stats_column_id FOR XML PATH('')), 1, 1, ''), '-'), '|',
              ISNULL(st.filter_definition, '-'))
FROM HSDZ_MES.sys.stats st
LEFT JOIN HSDZ_MES.sys.tables t ON t.object_id = st.object_id
WHERE st.user_created = 1;

/* ---------------- I) 扩展属性 ---------------- */
INSERT INTO #srv (cat, tbl, k)
SELECT 'XPROP', ISNULL(OBJECT_SCHEMA_NAME(ep.major_id) + '.' + OBJECT_NAME(ep.major_id), '-'),
       CONCAT(ep.class, '|', ISNULL(OBJECT_SCHEMA_NAME(ep.major_id) + '.' + OBJECT_NAME(ep.major_id), '-'), '|',
              ISNULL(COL_NAME(ep.major_id, ep.minor_id), '-'), '|', ep.name, '|', CONVERT(nvarchar(400), ep.value))
FROM HSDZ_MES_SRV1017.sys.extended_properties ep;

INSERT INTO #loc (cat, tbl, k)
SELECT 'XPROP', ISNULL(OBJECT_SCHEMA_NAME(ep.major_id) + '.' + OBJECT_NAME(ep.major_id), '-'),
       CONCAT(ep.class, '|', ISNULL(OBJECT_SCHEMA_NAME(ep.major_id) + '.' + OBJECT_NAME(ep.major_id), '-'), '|',
              ISNULL(COL_NAME(ep.major_id, ep.minor_id), '-'), '|', ep.name, '|', CONVERT(nvarchar(400), ep.value))
FROM HSDZ_MES.sys.extended_properties ep;

/* ---------------- 汇总:各类结构事实条数 ---------------- */
PRINT '===== 1) 各类结构事实条数(服务器快照 / 本地) =====';
SELECT cat AS 类别,
       (SELECT COUNT(*) FROM #srv s WHERE s.cat = c.cat) AS 服务器,
       (SELECT COUNT(*) FROM #loc l WHERE l.cat = c.cat) AS 本地
FROM (SELECT DISTINCT cat FROM #srv UNION SELECT DISTINCT cat FROM #loc) c ORDER BY cat;

/* ---------------- 双向差异(逐条) ---------------- */
PRINT '===== 2) 逐条差异:服务器有本地没有 =====';
SELECT cat AS 类别, k AS 结构事实 FROM #srv s
WHERE NOT EXISTS (SELECT 1 FROM #loc l WHERE l.cat = s.cat AND l.k = s.k) ORDER BY cat, k;

PRINT '===== 3) 逐条差异:本地有服务器没有 =====';
SELECT cat AS 类别, k AS 结构事实 FROM #loc l
WHERE NOT EXISTS (SELECT 1 FROM #srv s WHERE s.cat = l.cat AND s.k = l.k) ORDER BY cat, k;

/* ---------------- 按表做指纹 ---------------- */
IF OBJECT_ID('tempdb..#th_srv') IS NOT NULL DROP TABLE #th_srv;
IF OBJECT_ID('tempdb..#th_loc') IS NOT NULL DROP TABLE #th_loc;
CREATE TABLE #th_srv (tbl nvarchar(300), h char(32));
CREATE TABLE #th_loc (tbl nvarchar(300), h char(32));

INSERT INTO #th_srv (tbl, h)
SELECT d.tbl, CONVERT(char(32), HASHBYTES('MD5', (
    SELECT CAST(s.k AS nvarchar(max)) + N'§' FROM #srv s WHERE s.tbl = d.tbl ORDER BY s.cat, s.k
    FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)')), 2)
FROM (SELECT SCHEMA_NAME(schema_id)+'.'+name AS tbl FROM HSDZ_MES_SRV1017.sys.tables WHERE is_ms_shipped=0) d;

INSERT INTO #th_loc (tbl, h)
SELECT d.tbl, CONVERT(char(32), HASHBYTES('MD5', (
    SELECT CAST(l.k AS nvarchar(max)) + N'§' FROM #loc l WHERE l.tbl = d.tbl ORDER BY l.cat, l.k
    FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)')), 2)
FROM (SELECT SCHEMA_NAME(schema_id)+'.'+name AS tbl FROM HSDZ_MES.sys.tables WHERE is_ms_shipped=0) d;

PRINT '===== 4) 按表指纹:结构性不一致的表 =====';
SELECT COALESCE(s.tbl, l.tbl) AS 表,
       CASE WHEN s.tbl IS NULL THEN '本地独有表' WHEN l.tbl IS NULL THEN '服务器独有表' ELSE '指纹不同' END AS 差异
FROM #th_srv s
FULL JOIN #th_loc l ON l.tbl = s.tbl
WHERE s.h IS NULL OR l.h IS NULL OR s.h <> l.h
ORDER BY 表;

PRINT '===== 5) 指纹一致的表数 =====';
SELECT (SELECT COUNT(*) FROM #th_srv) AS 服务器表数,
       (SELECT COUNT(*) FROM #th_loc) AS 本地表数,
       (SELECT COUNT(*) FROM #th_srv s JOIN #th_loc l ON l.tbl = s.tbl AND l.h = s.h) AS 指纹一致表数;

/* ---------------- 结论 ---------------- */
DECLARE @bad int, @dtbl int;
SELECT @bad = (SELECT COUNT(*) FROM #srv s WHERE NOT EXISTS (SELECT 1 FROM #loc l WHERE l.cat = s.cat AND l.k = s.k))
            + (SELECT COUNT(*) FROM #loc l WHERE NOT EXISTS (SELECT 1 FROM #srv s WHERE s.cat = l.cat AND s.k = l.k));
SELECT @dtbl = (SELECT COUNT(*) FROM #th_srv s FULL JOIN #th_loc l ON l.tbl = s.tbl
                WHERE s.h IS NULL OR l.h IS NULL OR s.h <> l.h);
PRINT '--------------------------------------------------------------';
PRINT N'RESULT: 结构事实差异 ' + CAST(@bad AS varchar(10)) + N' 条;结构指纹不同的表 ' + CAST(@dtbl AS varchar(10)) + N' 张';
PRINT '--------------------------------------------------------------';
GO


