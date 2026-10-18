SET NOCOUNT ON;
PRINT '=== 月结结转行是否被算进 kucun ===';
SELECT 单据类型, COUNT(*) n, SUM(数量) q FROM inh WHERE 单据编号=N'JZ-202609' GROUP BY 单据类型;
PRINT '=== kucun 与流水差异 TOP5 ===';
WITH F AS (
  SELECT 物料编码 w, 仓库编码 c, ISNULL(RTRIM(批号),N'') l, SUM(数量) q FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' GROUP BY 物料编码,仓库编码,ISNULL(RTRIM(批号),N'')
  UNION ALL SELECT 物料编码, 仓库编码, ISNULL(RTRIM(批号),N''), -SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 物料编码,仓库编码,ISNULL(RTRIM(批号),N'')
), FS AS (SELECT ISNULL(RTRIM(w),N'') w, ISNULL(RTRIM(c),N'') c, l, SUM(q) q FROM F GROUP BY ISNULL(RTRIM(w),N''),ISNULL(RTRIM(c),N''),l),
K AS (SELECT wzdm w, ISNULL(RTRIM(ckdm),N'') c, ISNULL(RTRIM(lot_no),N'') l, SUM(yl) yl FROM kucun GROUP BY wzdm,ISNULL(RTRIM(ckdm),N''),ISNULL(RTRIM(lot_no),N''))
SELECT TOP 5 K.w, K.c, K.l, K.yl 库存, FS.q 流水, K.yl-ISNULL(FS.q,0) 差
FROM K FULL OUTER JOIN FS ON FS.w=K.w AND FS.c=K.c AND FS.l=K.l
ORDER BY ABS(ISNULL(K.yl,0)-ISNULL(FS.q,0)) DESC;
