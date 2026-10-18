SET NOCOUNT ON;
PRINT '=== 按 (物料,仓库,批号=NULL归并) 对比 kucun 与流水 ===';
WITH F AS (
  SELECT 物料编码 w, 仓库编码 c, CASE WHEN 批号='PC0000' THEN NULL ELSE 批号 END l, SUM(数量) q FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' GROUP BY 物料编码,仓库编码,CASE WHEN 批号='PC0000' THEN NULL ELSE 批号 END
  UNION ALL
  SELECT 物料编码, 仓库编码, CASE WHEN 批号='PC0000' THEN NULL ELSE 批号 END, -SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 物料编码,仓库编码,CASE WHEN 批号='PC0000' THEN NULL ELSE 批号 END
), FS AS (SELECT w,c,l,SUM(q) q FROM F GROUP BY w,c,l),
K AS (SELECT wzdm w, ckdm c, CASE WHEN lot_no='PC0000' THEN NULL ELSE lot_no END l, SUM(yl) yl FROM kucun GROUP BY wzdm,ckdm,CASE WHEN lot_no='PC0000' THEN NULL ELSE lot_no END)
SELECT COUNT(*) AS 差异键数, SUM(CASE WHEN ABS(ISNULL(K.yl,0)-ISNULL(FS.q,0))>0.01 THEN 1 ELSE 0 END) AS 超0.01的键数
FROM K FULL OUTER JOIN FS ON FS.w=K.w AND FS.c=K.c AND ISNULL(FS.l,'')=ISNULL(K.l,'');
PRINT '=== 合并后总量对比 ===';
WITH F AS (
  SELECT 数量 q FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转'
  UNION ALL SELECT -数量 FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y')
SELECT (SELECT SUM(q) FROM F) 流水净额, (SELECT SUM(yl) FROM kucun) 库存合计;
