-- r-11:单据数据量 + 扫码列取证(修正列名,避免整脚本中断)
SET NOCOUNT ON;
GO
PRINT '=== [1] wo_stage_report 列结构(含 qr_code) ===';
SELECT c.column_id, c.name, t.name AS type FROM sys.columns c
JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('wo_stage_report') ORDER BY c.column_id;
GO
PRINT '=== [2] wo_material_pick 列结构(含 qr_code) ===';
SELECT c.column_id, c.name, t.name AS type FROM sys.columns c
JOIN sys.types t ON c.user_type_id=t.user_type_id
WHERE c.object_id=OBJECT_ID('wo_material_pick') ORDER BY c.column_id;
GO
PRINT '=== [3] qr_code 列有值的行数 ===';
SELECT 'wo_stage_report' AS t, COUNT(*) AS rows_total,
       SUM(CASE WHEN qr_code IS NOT NULL AND qr_code <> '' THEN 1 ELSE 0 END) AS qr_filled
FROM wo_stage_report
UNION ALL
SELECT 'wo_material_pick', COUNT(*),
       SUM(CASE WHEN qr_code IS NOT NULL AND qr_code <> '' THEN 1 ELSE 0 END)
FROM wo_material_pick;
GO
PRINT '=== [4] 采购链单据数据量 ===';
SELECT 'bd_pu_order' AS t, COUNT(*) AS rows FROM bd_pu_order
UNION ALL SELECT 'sl_recv', COUNT(*) FROM sl_recv
UNION ALL SELECT 'qc_insp', COUNT(*) FROM qc_insp
UNION ALL SELECT 'qc_return', COUNT(*) FROM qc_return
UNION ALL SELECT 'bd_purchase_in', COUNT(*) FROM bd_purchase_in
UNION ALL SELECT 'qc_tc', COUNT(*) FROM qc_tc
UNION ALL SELECT 'bs_inv', COUNT(*) FROM bs_inv;
GO
PRINT '=== [5] 打印次数实际取值(asp_print 分布) ===';
SELECT TOP 10 [单据编号], asp_print FROM bd_pu_order ORDER BY asp_print DESC;
GO
