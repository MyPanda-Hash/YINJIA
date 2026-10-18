SET NOCOUNT ON;
PRINT '=== 逐键对账(物料,仓库,批号):kucun vs Σ流水 ===';
WITH F AS (
  SELECT 物料编码 w, 仓库编码 c, ISNULL(RTRIM(批号),N'') l, SUM(数量) q
  FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
  GROUP BY 物料编码,仓库编码,ISNULL(RTRIM(批号),N'')
  UNION ALL
  SELECT 物料编码, 仓库编码, ISNULL(RTRIM(批号),N''), -SUM(数量)
  FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'
  GROUP BY 物料编码,仓库编码,ISNULL(RTRIM(批号),N'')
),
FS AS (SELECT ISNULL(RTRIM(w),N'') w, ISNULL(RTRIM(c),N'') c, l, SUM(q) q FROM F GROUP BY ISNULL(RTRIM(w),N''),ISNULL(RTRIM(c),N''),l),
K AS (SELECT wzdm w, ISNULL(RTRIM(ckdm),N'') c, ISNULL(RTRIM(lot_no),N'') l, SUM(yl) yl FROM kucun GROUP BY wzdm,ISNULL(RTRIM(ckdm),N''),ISNULL(RTRIM(lot_no),N''))
SELECT COUNT(*) 键总数,
       SUM(CASE WHEN ABS(ISNULL(K.yl,0)-ISNULL(FS.q,0))>0.01 THEN 1 ELSE 0 END) 不一致键,
       SUM(CASE WHEN ABS(ISNULL(K.yl,0)-ISNULL(FS.q,0))>0.01 THEN ISNULL(K.yl,0)-ISNULL(FS.q,0) ELSE 0 END) 不一致差额
FROM K FULL OUTER JOIN FS ON FS.w=K.w AND FS.c=K.c AND FS.l=K.l;
