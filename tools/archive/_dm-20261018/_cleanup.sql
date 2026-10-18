SET NOCOUNT ON;
DELETE FROM erp_imp_row WHERE 批次号 LIKE 'IMP-%';
DELETE FROM erp_imp_log WHERE 批次号 LIKE 'IMP-%';
SELECT COUNT(*) AS 残留头 FROM erp_imp_log WHERE 批次号 LIKE 'IMP-%';
