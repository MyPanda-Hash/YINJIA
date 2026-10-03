SET NOCOUNT ON;
-- 1. QC_RETURN 行表数量字段的登记(两库对照)
SELECT id, place, seq, col_name, label, hidden, visible FROM yj_field WHERE panel_code='QC_RETURN' AND place LIKE '%detail%' AND (col_name LIKE N'%数量%' OR label LIKE N'%数量%') ORDER BY seq;
GO
-- 2. qc_return_detail 实际列(数量 vs 退货数量)
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_return_detail' AND (COLUMN_NAME LIKE N'%数量%');
GO
-- 3. 最近自动生成的退回单:行值证据(近10张)
SELECT TOP 10 d.单据编号, d.物料编码, d.数量, d.退货数量, l.linked_quantity, l.source_line_key, t.不良数量
  FROM form_flow_link l
  JOIN qc_return_detail d ON d.单据编号 = l.target_form_no AND l.target_line_key = N'' + l.target_form_no + N'#' + CAST(d.id AS nvarchar(20))
  JOIN qc_insp_detail t ON t.单据编号 = l.source_form_no AND l.source_line_key = l.source_form_no + N'#' + CAST(t.id AS nvarchar(20))
  WHERE l.source_panel_code='QC_INSP' AND l.target_panel_code='QC_RETURN'
  ORDER BY d.id DESC;
GO
