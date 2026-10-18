SET NOCOUNT ON;
PRINT '=== 备份当前 kucun ===';
IF OBJECT_ID('dbo.kucun_bak_beforelot') IS NOT NULL DROP TABLE dbo.kucun_bak_beforelot;
SELECT * INTO dbo.kucun_bak_beforelot FROM kucun;
SELECT COUNT(*) 备份行数, SUM(yl) 备份合计 FROM dbo.kucun_bak_beforelot;
PRINT '=== 408 个差异键的规模分析 ===';
WITH F AS (
  SELECT 物料编码 w, 仓库编码 c, CASE WHEN 批号='PC0000' THEN NULL ELSE 批号 END l, SUM(数量) q FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND ISNULL(单据类型,'')<>N'月结结转' GROUP BY 物料编码,仓库编码,CASE WHEN 批号='PC0000' THEN NULL ELSE 批号 END
  UNION ALL
  SELECT 物料编码, 仓库编码, CASE WHEN 批号='PC0000' THEN NULL ELSE 批号 END, -SUM(数量) FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 物料编码,仓库编码,CASE WHEN 批号='PC0000' THEN NULL ELSE 批号 END
), FS AS (SELECT w,c,l,SUM(q) q FROM F GROUP BY w,c,l),
K AS (SELECT wzdm w, ckdm c, CASE WHEN lot_no='PC0000' THEN NULL ELSE lot_no END l, SUM(yl) yl FROM kucun GROUP BY wzdm,ckdm,CASE WHEN lot_no='PC0000' THEN NULL ELSE lot_no END),
D AS (SELECT ISNULL(K.w,FS.w) w, ISNULL(K.c,FS.c) c, ISNULL(K.l,FS.l) l, ISNULL(K.yl,0) ky, ISNULL(FS.q,0) fq
      FROM K FULL OUTER JOIN FS ON FS.w=K.w AND FS.c=K.c AND ISNULL(FS.l,'')=ISNULL(K.l,'')
      WHERE ABS(ISNULL(K.yl,0)-ISNULL(FS.q,0)) > 0.01)
SELECT COUNT(*) 差异键, SUM(CASE WHEN l IS NULL THEN 1 ELSE 0 END) 无批号键, SUM(CASE WHEN l IS NOT NULL THEN 1 ELSE 0 END) 有批号键 FROM D;
