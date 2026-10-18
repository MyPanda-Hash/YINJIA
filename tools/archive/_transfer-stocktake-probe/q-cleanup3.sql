SET NOCOUNT ON;
DECLARE @nos TABLE (no nvarchar(50) PRIMARY KEY);
INSERT INTO @nos VALUES (N'DB-2026-10-0001'),(N'DB-2026-10-0002'),(N'PD-2026-10-0001'),(N'PD-2026-10-0002');
DELETE FROM inh WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM outh WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM bl_transfer WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM bd_transfer WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM bl_stocktake WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM bd_stocktake WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM yj_doc_status WHERE panel_code IN ('TRANSFER','STOCKTAKE') AND doc_no IN (SELECT no FROM @nos);
PRINT '删除完成';
SELECT 'bd_transfer' AS t, COUNT(*) AS n FROM bd_transfer
UNION ALL SELECT 'bd_stocktake', COUNT(*) FROM bd_stocktake
UNION ALL SELECT 'bl_transfer', COUNT(*) FROM bl_transfer
UNION ALL SELECT 'bl_stocktake', COUNT(*) FROM bl_stocktake
UNION ALL SELECT 'yj_doc_status', COUNT(*) FROM yj_doc_status WHERE panel_code IN ('TRANSFER','STOCKTAKE')
UNION ALL SELECT 's_allno(DB/PD)', COUNT(*) FROM s_allno WHERE lb IN ('DB','PD');
