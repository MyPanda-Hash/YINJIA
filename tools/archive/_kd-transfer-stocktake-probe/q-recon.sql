SET NOCOUNT ON;
PRINT '=== 月结重算 vs 备份:同一口径对比(按物料+仓库+批号) ===';
WITH B AS (SELECT wzdm, ckdm, ISNULL(lot_no,'') lot, SUM(yl) yl FROM kucun_bak_20261018 GROUP BY wzdm,ckdm,ISNULL(lot_no,'')),
     K AS (SELECT wzdm, ckdm, ISNULL(lot_no,'') lot, SUM(yl) yl FROM kucun GROUP BY wzdm,ckdm,ISNULL(lot_no,'')),
     D AS (SELECT ISNULL(B.wzdm,K.wzdm) wzdm, ISNULL(B.ckdm,K.ckdm) ckdm, ISNULL(B.lot,K.lot) lot, B.yl 备份, K.yl 现算
           FROM B FULL OUTER JOIN K ON K.wzdm=B.wzdm AND K.ckdm=B.ckdm AND K.lot=B.lot)
SELECT COUNT(*) 差异行数, SUM(CASE WHEN 现算 IS NULL THEN 1 ELSE 0 END) 现算无, SUM(CASE WHEN 备份 IS NULL THEN 1 ELSE 0 END) 备份无
FROM D WHERE ISNULL(备份,0) <> ISNULL(现算,0);
PRINT '=== 差异样例(前10) ===';
WITH B AS (SELECT wzdm, ckdm, ISNULL(lot_no,'') lot, SUM(yl) yl FROM kucun_bak_20261018 GROUP BY wzdm,ckdm,ISNULL(lot_no,'')),
     K AS (SELECT wzdm, ckdm, ISNULL(lot_no,'') lot, SUM(yl) yl FROM kucun GROUP BY wzdm,ckdm,ISNULL(lot_no,''))
SELECT TOP 10 ISNULL(B.wzdm,K.wzdm) wzdm, ISNULL(B.ckdm,K.ckdm) ckdm, ISNULL(B.lot,K.lot) lot, B.yl 备份, K.yl 现算
FROM B FULL OUTER JOIN K ON K.wzdm=B.wzdm AND K.ckdm=B.ckdm AND K.lot=B.lot
WHERE ISNULL(B.yl,0) <> ISNULL(K.yl,0) ORDER BY ABS(ISNULL(K.yl,0)-ISNULL(B.yl,0)) DESC;
