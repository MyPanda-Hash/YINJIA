-- _q-picklist-1014d.sql — 探针 v4:mate(物料清单/BOM)与工单产品的对应关系(只读)
SET NOCOUNT ON;
PRINT '=== 1) mate 最近 5 行 ===';
SELECT TOP 5 * FROM dbo.mate ORDER BY id DESC;
PRINT '=== 2) mate.wzdm1 是否命中工单产品(plang.dm) ===';
SELECT TOP 10 p.pl_no, p.dm AS 工单产品, p.mc, m.m_no, m.wzdm1, m.wzdm2, m.wzmc2, m.bzl, m.shl, m.sl2
FROM plang p JOIN dbo.mate m ON m.wzdm1 = p.dm ORDER BY p.id DESC;
PRINT '=== 3) 命中数 ===';
SELECT COUNT(DISTINCT p.id) AS 命中工单行, COUNT(*) AS 关联行数 FROM plang p JOIN dbo.mate m ON m.wzdm1 = p.dm;
PRINT '=== 4) mate 单号重复度 ===';
SELECT COUNT(*) AS 行数, COUNT(DISTINCT m_no) AS 单号数, COUNT(DISTINCT wzdm1) AS 产品数 FROM dbo.mate;
PRINT '=== 5) WLBOM 面板字段 ===';
SELECT place, seq, label, col_name, data_type, ref_panel, ref_field, required FROM yj_field WHERE panel_code = N'WLBOM' ORDER BY place, seq, id;
PRINT '=== 6) plang 一行样例(关键列) ===';
SELECT TOP 2 * FROM plang ORDER BY id DESC;
