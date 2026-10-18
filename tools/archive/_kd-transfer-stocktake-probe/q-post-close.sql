SET NOCOUNT ON;
SELECT (SELECT COUNT(*) FROM kucun) AS 当前行数, (SELECT SUM(yl) FROM kucun) AS 当前合计,
       (SELECT COUNT(*) FROM kucun_bak_20261018) AS 备份行数, (SELECT SUM(yl) FROM kucun_bak_20261018) AS 备份合计;
PRINT '=== 差异:备份有而当前无的行数 ===';
SELECT COUNT(*) AS 备份有当前无 FROM kucun_bak_20261018 b
WHERE NOT EXISTS (SELECT 1 FROM kucun k WHERE k.wzdm=b.wzdm AND k.ckdm=b.ckdm AND ISNULL(k.lot_no,'')=ISNULL(b.lot_no,''));
PRINT '=== 当前有而备份无的行数 ===';
SELECT COUNT(*) AS 当前有备份无 FROM kucun k
WHERE NOT EXISTS (SELECT 1 FROM kucun_bak_20261018 b WHERE k.wzdm=b.wzdm AND k.ckdm=b.ckdm AND ISNULL(k.lot_no,'')=ISNULL(b.lot_no,''));
