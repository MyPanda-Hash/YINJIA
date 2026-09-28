SET NOCOUNT ON;
-- QC_RETURN 全部字段(代码写入集合的落地审计)
SELECT place, seq, col_name, label, hidden, visible FROM yj_field WHERE panel_code='QC_RETURN' ORDER BY place, seq, id;
GO
-- 近期自动退回单行的数量证据(不引用退货数量列)
SELECT TOP 10 d.单据编号, d.物料编码, d.数量 AS 退回行数量, l.linked_quantity AS 占用不良数, t.不良数量 AS 检验行不良数, d.asp_time1
  FROM form_flow_link l
  JOIN qc_return_detail d ON d.单据编号 = l.target_form_no AND d.id = TRY_CAST(REPLACE(l.target_line_key, l.target_form_no + N'#', N'') AS int)
  JOIN qc_insp_detail t ON t.单据编号 = l.source_form_no AND t.id = TRY_CAST(REPLACE(l.source_line_key, l.source_form_no + N'#', N'') AS int)
  WHERE l.source_panel_code='QC_INSP' AND l.target_panel_code='QC_RETURN'
  ORDER BY d.id DESC;
GO
