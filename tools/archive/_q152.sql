SET NOCOUNT ON;
SELECT c.name FROM sys.columns c WHERE c.object_id=OBJECT_ID('dbo.bd_purchase_in') AND (c.name LIKE N'%订单%' OR c.name LIKE N'%来源%');
-- form_flow_link 是否已有 PU_ORDER 流
SELECT source_panel_code, target_panel_code, COUNT(*) AS n FROM form_flow_link GROUP BY source_panel_code, target_panel_code;
-- yj_doc_status.archived 列现状
SELECT COUNT(*) AS archived_use FROM yj_doc_status WHERE archived IS NOT NULL;
