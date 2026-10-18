SET NOCOUNT ON;
WITH F AS (
  SELECT 物料编码 w, 仓库编码 c, 批号 l, SUM(数量) q FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' GROUP BY 物料编码,仓库编码,批号
  UNION ALL
  SELECT 物料编码, 仓库编码, 批号, -SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 物料编码,仓库编码,批号
), FS AS (SELECT w,c,l,SUM(q) q FROM F GROUP BY w,c,l),
K AS (SELECT wzdm w, ckdm c, lot_no l, SUM(yl) yl FROM kucun GROUP BY wzdm,ckdm,lot_no),
D AS (SELECT ISNULL(K.w,FS.w) w, ISNULL(K.c,FS.c) c, ISNULL(K.l,FS.l) l, ISNULL(K.yl,0) ky, ISNULL(FS.q,0) fq
      FROM K FULL OUTER JOIN FS ON FS.w=K.w AND FS.c=K.c AND ISNULL(FS.l,'')=ISNULL(K.l,'')
      WHERE ABS(ISNULL(K.yl,0)-ISNULL(FS.q,0)) > 0.01)
SELECT SUM(ky) 库存侧, SUM(fq) 流水侧, SUM(ky)-SUM(fq) 净差,
       SUM(CASE WHEN ABS(ky-fq)>1000 THEN 1 ELSE 0 END) 大差异键数,
       SUM(CASE WHEN ky=0 THEN 1 ELSE 0 END) 库存无流水有,
       SUM(CASE WHEN fq=0 THEN 1 ELSE 0 END) 流水无库存有
FROM D;
PRINT '=== 差异最大的10个 ===';
WITH F AS (
  SELECT 物料编码 w, 仓库编码 c, 批号 l, SUM(数量) q FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' GROUP BY 物料编码,仓库编码,批号
  UNION ALL SELECT 物料编码, 仓库编码, 批号, -SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 物料编码,仓库编码,批号
), FS AS (SELECT w,c,l,SUM(q) q FROM F GROUP BY w,c,l),
K AS (SELECT wzdm w, ckdm c, lot_no l, SUM(yl) yl FROM kucun GROUP BY wzdm,ckdm,lot_no)
SELECT TOP 10 ISNULL(K.w,FS.w) w, ISNULL(K.c,FS.c) c, ISNULL(K.l,FS.l) l, ISNULL(K.yl,0) 库存, ISNULL(FS.q,0) 流水
FROM K FULL OUTER JOIN FS ON FS.w=K.w AND FS.c=K.c AND ISNULL(FS.l,'')=ISNULL(K.l,'')
WHERE ABS(ISNULL(K.yl,0)-ISNULL(FS.q,0)) > 0.01 ORDER BY ABS(ISNULL(K.yl,0)-ISNULL(FS.q,0)) DESC;
