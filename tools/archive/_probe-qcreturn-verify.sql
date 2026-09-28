SET NOCOUNT ON;
-- 回填终验:四张自动退回单
SELECT d.单据编号, d.物料编码, d.数量 AS 退回行数量, h.检验单号, h.单据状态
  FROM qc_return_detail d JOIN qc_return h ON h.单据编号 = d.单据编号
 WHERE d.单据编号 IN (SELECT DISTINCT target_form_no FROM form_flow_link WHERE target_panel_code=N'QC_RETURN' AND source_panel_code=N'QC_INSP')
 ORDER BY d.id;
GO
-- 检验单号 字段行已登记?
SELECT id, place, seq, col_name, label, ref_panel, ref_field FROM yj_field WHERE panel_code='QC_RETURN' AND col_name=N'检验单号';
GO
