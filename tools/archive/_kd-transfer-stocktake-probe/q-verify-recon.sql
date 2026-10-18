SET NOCOUNT ON;
WITH F AS (
  SELECT 物料编码 w, 仓库编码 c, 批号 l, SUM(数量) q FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' GROUP BY 物料编码,仓库编码,批号
  UNION ALL SELECT 物料编码, 仓库编码, 批号, -SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 物料编码,仓库编码,批号
), FS AS (SELECT ISNULL(RTRIM(w),N'') w, ISNULL(RTRIM(c),N'') c, ISNULL(RTRIM(l),N'') l, SUM(q) q FROM F GROUP BY ISNULL(RTRIM(w),N''),ISNULL(RTRIM(c),N''),ISNULL(RTRIM(l),N'')),
K AS (SELECT wzdm w, ISNULL(RTRIM(ckdm),N'') c, ISNULL(RTRIM(lot_no),N'') l, SUM(yl) yl FROM kucun GROUP BY wzdm, ISNULL(RTRIM(ckdm),N''), ISNULL(RTRIM(lot_no),N''))
SELECT COUNT(*) AS 差异键数,
       SUM(CASE WHEN ABS(ISNULL(K.yl,0)-ISNULL(FS.q,0)) > 0.01 THEN 1 ELSE 0 END) AS 超容差键,
       SUM(ISNULL(K.yl,0)) 库存侧, SUM(ISNULL(FS.q,0)) 流水侧
FROM K FULL OUTER JOIN FS ON FS.w=K.w AND FS.c=K.c AND FS.l=K.l;
