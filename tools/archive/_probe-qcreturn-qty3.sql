SET NOCOUNT ON;
-- qc_return 头表是否有 检验单号 列
SELECT CASE WHEN COL_LENGTH('dbo.qc_return', N'检验单号') IS NULL THEN N'无' ELSE N'有' END AS 头表检验单号列,
       CASE WHEN COL_LENGTH('dbo.qc_return_detail', N'退货数量') IS NULL THEN N'无' ELSE N'有' END AS 行表退货数量列;
GO
-- 三张问题退回单的状态与源检验单
SELECT l.target_form_no AS 退回单, d.单据状态, l.source_form_no AS 源检验单, l.link_status
  FROM form_flow_link l JOIN qc_return d ON d.单据编号 = l.target_form_no
  WHERE l.source_panel_code='QC_INSP' AND l.target_panel_code='QC_RETURN'
  ORDER BY l.target_form_no;
GO
