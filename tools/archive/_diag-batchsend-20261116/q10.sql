SET NOCOUNT ON;
PRINT '== 面板 line/head 表 ==';
SELECT panel_code, panel_name, head_table, line_table, group_col FROM yj_panel
WHERE panel_code IN ('PU_ORDER','SO_ORDER','QC_RECV','QC_INSP','QC_RETURN','PURCHASE_IN','QC_TC_IN','PLANG');
GO
PRINT '== asp_time1/2 列类型 ==';
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('bl_pu_order','bl_so_order') AND COLUMN_NAME LIKE 'asp_time%';
GO
PRINT '== bd_pu_label 列 ==';
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bd_pu_label' ORDER BY ORDINAL_POSITION;
GO
PRINT '== PU_ORDER 失效 link 的 target_line_key 样本 ==';
SELECT TOP 12 id, source_form_no, source_line_key, target_panel_code, target_form_no, target_line_key, linked_quantity, link_status, create_time
FROM form_flow_link
WHERE source_panel_code = N'PU_ORDER'
  AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号 = form_flow_link.source_form_no
                  AND o.单据编号 + N'#' + CAST(o.id AS nvarchar(20)) = form_flow_link.source_line_key)
ORDER BY id DESC;
GO
PRINT '== 按目标面板统计失效条数 ==';
SELECT target_panel_code, COUNT(*) AS n FROM form_flow_link
WHERE source_panel_code = N'PU_ORDER'
  AND NOT EXISTS (SELECT 1 FROM bl_pu_order o WHERE o.单据编号 = form_flow_link.source_form_no
                  AND o.单据编号 + N'#' + CAST(o.id AS nvarchar(20)) = form_flow_link.source_line_key)
GROUP BY target_panel_code;
