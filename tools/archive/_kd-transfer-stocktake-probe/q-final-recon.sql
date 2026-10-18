SET NOCOUNT ON;
PRINT '=== 月结后 kucun 与流水对账 ===';
WITH F AS (
  SELECT 物料编码 w, 仓库编码 c, ISNULL(RTRIM(批号),N'') l, SUM(数量) q FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' GROUP BY 物料编码,仓库编码,ISNULL(RTRIM(批号),N'')
  UNION ALL SELECT 物料编码, 仓库编码, ISNULL(RTRIM(批号),N''), -SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 物料编码,仓库编码,ISNULL(RTRIM(批号),N'')
), FS AS (SELECT ISNULL(RTRIM(w),N'') w, ISNULL(RTRIM(c),N'') c, l, SUM(q) q FROM F GROUP BY ISNULL(RTRIM(w),N''),ISNULL(RTRIM(c),N''),l),
K AS (SELECT wzdm w, ISNULL(RTRIM(ckdm),N'') c, ISNULL(RTRIM(lot_no),N'') l, SUM(yl) yl FROM kucun GROUP BY wzdm,ISNULL(RTRIM(ckdm),N''),ISNULL(RTRIM(lot_no),N''))
SELECT SUM(CASE WHEN ABS(ISNULL(K.yl,0)-ISNULL(FS.q,0))>0.01 THEN 1 ELSE 0 END) 超容差键, SUM(ISNULL(K.yl,0)) 库存侧, SUM(ISNULL(FS.q,0)) 流水侧
FROM K FULL OUTER JOIN FS ON FS.w=K.w AND FS.c=K.c AND FS.l=K.l;
PRINT '=== 月结记录 ===';
SELECT 期间, 状态, 结转单据编号, 行数, 入库合计, 出库合计, 结存合计 FROM bd_stock_close;
PRINT '=== 结转行 ===';
SELECT COUNT(*) AS 行数, SUM(数量) AS 合计 FROM inh WHERE 单据编号=N'JZ-202609';
