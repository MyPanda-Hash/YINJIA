SET NOCOUNT ON;
PRINT '=== A. wo_mixing_list columns ===';
SELECT c.column_id AS ord, c.name AS col, t.name AS typ, c.max_length AS len, c.precision AS prec, c.scale AS scl, c.is_nullable AS nullable
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
 WHERE c.object_id = OBJECT_ID(N'dbo.wo_mixing_list') ORDER BY c.column_id;

PRINT '=== B. wo_mixing_list rows by mark ===';
SELECT 标记 AS mark, COUNT(*) AS rows_, COUNT(DISTINCT 单据编号) AS docs FROM dbo.wo_mixing_list GROUP BY 标记;

PRINT '=== C. latest 5 rows ===';
SELECT TOP 5 id, 单据编号 AS docno, 工单号 AS wono, 工单行号 AS line, 物料编号 AS mat, 计划用量 AS planq, 实际用量 AS actualq, 标记 AS mark FROM dbo.wo_mixing_list ORDER BY id DESC;

PRINT '=== D. mate rows ===';
SELECT COUNT(*) AS rows_, COUNT(DISTINCT m_no) AS products FROM dbo.mate;
SELECT TOP 5 id, m_no, wzdm2, wzmc2, gg2, jldw2, bzl, sl2 FROM dbo.mate ORDER BY id;

PRINT '=== E. plang sample ===';
SELECT TOP 3 id, pl_no, pl_xc, dm, mc, scx, pl_sl, lot_no FROM dbo.plang ORDER BY id DESC;

PRINT '=== F. yj_role_panel columns ===';
SELECT c.name AS col FROM sys.columns c WHERE c.object_id = OBJECT_ID(N'dbo.yj_role_panel') ORDER BY c.column_id;
