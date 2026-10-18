SET NOCOUNT ON;
DECLARE @nos TABLE (no nvarchar(50) PRIMARY KEY);
INSERT INTO @nos SELECT [单据编号] FROM bd_transfer WHERE [单据编号] <> N'DB-2026-10-0001'
UNION SELECT [单据编号] FROM bd_stocktake WHERE [单据编号] <> N'PD-2026-10-0001';
IF NOT EXISTS (SELECT 1 FROM @nos) PRINT N'无探针残留单据';
DELETE FROM bl_transfer WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM bd_transfer WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM bl_stocktake WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM bd_stocktake WHERE 单据编号 IN (SELECT no FROM @nos);
DELETE FROM yj_doc_status WHERE panel_code IN ('TRANSFER','STOCKTAKE') AND doc_no IN (SELECT no FROM @nos);
DELETE FROM yj_usage_log WHERE doc_no IN (SELECT no FROM @nos);
DELETE FROM yj_form_approval WHERE form_no IN (SELECT no FROM @nos);
DELETE FROM s_allno WHERE dh IN (SELECT no FROM @nos);
SELECT [单据编号], N'保留' AS 状态 FROM bd_transfer UNION ALL SELECT [单据编号], N'保留' FROM bd_stocktake;
