SET NOCOUNT ON;
DECLARE @nos TABLE (no nvarchar(50) PRIMARY KEY);
INSERT INTO @nos VALUES (N'DB-2026-10-0001'),(N'DB-2026-10-0002'),(N'PD-2026-10-0001'),(N'PD-2026-10-0002');
DELETE FROM yj_form_approval WHERE form_no IN (SELECT no FROM @nos);
DELETE FROM yj_usage_log WHERE doc_no IN (SELECT no FROM @nos);
DELETE FROM s_allno WHERE dh IN (SELECT no FROM @nos);
PRINT '清理完成(剩余步骤)';
SELECT 'bd_transfer' AS t, COUNT(*) AS n FROM bd_transfer
UNION ALL SELECT 'bd_stocktake', COUNT(*) FROM bd_stocktake
UNION ALL SELECT 'bl_transfer', COUNT(*) FROM bl_transfer
UNION ALL SELECT 'bl_stocktake', COUNT(*) FROM bl_stocktake
UNION ALL SELECT 'yj_doc_status', COUNT(*) FROM yj_doc_status WHERE panel_code IN ('TRANSFER','STOCKTAKE')
UNION ALL SELECT 'yj_form_approval', COUNT(*) FROM yj_form_approval WHERE panel_code IN ('TRANSFER','STOCKTAKE')
UNION ALL SELECT 's_allno(DB/PD)', COUNT(*) FROM s_allno WHERE lb IN ('DB','PD')
UNION ALL SELECT 'inh/outh(TEST)', COUNT(*) FROM inh WHERE 单据编号 LIKE 'DB-2026-10-%' OR 单据编号 LIKE 'PD-2026-10-%';
PRINT '=== 关键库存行现值(应 416200 / 0 / 0) ===';
SELECT wzdm, ckdm, lot_no, yl, rkl, ckl FROM kucun WHERE wzdm='HP-08' AND ckdm='CK00006' AND lot_no='PC0000';
