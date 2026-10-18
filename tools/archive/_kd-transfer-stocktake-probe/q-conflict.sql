SET NOCOUNT ON;
PRINT '=== 合并会冲突吗:同一(物料,仓库)下 PC0000 行 与 NULL 行 并存的数量 ===';
SELECT COUNT(*) AS 冲突键数 FROM (
  SELECT wzdm, ckdm FROM kucun GROUP BY wzdm, ckdm
  HAVING SUM(CASE WHEN lot_no IS NULL THEN 1 ELSE 0 END) > 0 AND SUM(CASE WHEN lot_no='PC0000' THEN 1 ELSE 0 END) > 0
) t;
PRINT '=== 冲突样例(前10) ===';
SELECT TOP 10 wzdm, ckdm,
  (SELECT SUM(yl) FROM kucun k2 WHERE k2.wzdm=k.wzdm AND k2.ckdm=k.ckdm AND k2.lot_no IS NULL) AS NULL行合计,
  (SELECT SUM(yl) FROM kucun k3 WHERE k3.wzdm=k.wzdm AND k3.ckdm=k.ckdm AND k3.lot_no='PC0000') AS PC0000行合计
FROM kucun k GROUP BY wzdm, ckdm
HAVING SUM(CASE WHEN lot_no IS NULL THEN 1 ELSE 0 END) > 0 AND SUM(CASE WHEN lot_no='PC0000' THEN 1 ELSE 0 END) > 0
ORDER BY ABS((SELECT SUM(yl) FROM kucun k2 WHERE k2.wzdm=k.wzdm AND k2.ckdm=k.ckdm AND k2.lot_no IS NULL)) DESC;
