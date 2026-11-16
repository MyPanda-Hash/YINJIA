SET NOCOUNT ON;
PRINT '== flow links for YJ-20261111-06 ==';
SELECT id, source_panel_code, source_form_no, source_detail_key, source_line_key, target_panel_code,
       target_form_no, linked_quantity, link_status, batch_no, batch_id, create_by, create_time
FROM form_flow_link WHERE source_form_no = N'YJ-20261111-06' ORDER BY id;
GO
PRINT '== 11039 as source_line_key anywhere ==';
SELECT TOP 20 id, source_panel_code, source_form_no, source_line_key, target_form_no, linked_quantity, link_status, batch_no, create_time
FROM form_flow_link WHERE source_line_key LIKE '%#11039%' OR CAST(source_line_key AS nvarchar(200)) LIKE N'%11039%' ORDER BY id DESC;
GO
PRINT '== material label tables ==';
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%label%' OR TABLE_NAME LIKE '%pu_%' ORDER BY TABLE_NAME;
GO
PRINT '== 11039 in bl_pu_order? ==';
SELECT id, 单据编号 FROM bl_pu_order WHERE id BETWEEN 11030 AND 11050;
