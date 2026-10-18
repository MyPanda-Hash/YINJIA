SET NOCOUNT ON;
BEGIN TRAN;
DELETE FROM inh WHERE 单据编号 LIKE 'YCD%' AND src=9;
DELETE FROM outh WHERE 单据编号 LIKE 'YCD%' AND src=10;
DELETE FROM bl_transfer WHERE 单据编号 LIKE 'YCD%';
DELETE FROM bd_transfer WHERE 单据编号 LIKE 'YCD%';
DELETE FROM yj_doc_status WHERE panel_code='TRANSFER' AND doc_no LIKE 'YCD%';
DELETE FROM yj_usage_log WHERE doc_no LIKE 'YCD%';
DELETE FROM yj_form_approval WHERE form_no LIKE 'YCD%';
COMMIT;
PRINT '=== 清理后剩余 ===';
SELECT (SELECT COUNT(*) FROM bd_transfer WHERE 单据编号 LIKE 'YCD%') AS 调拨单残留,
       (SELECT COUNT(*) FROM inh WHERE 单据编号 LIKE 'YCD%') AS inh残留,
       (SELECT COUNT(*) FROM outh WHERE 单据编号 LIKE 'YCD%') AS outh残留;
SELECT 单据编号, 单据日期 FROM bd_transfer ORDER BY id;
