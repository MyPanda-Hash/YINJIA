SET NOCOUNT ON;
SELECT N'1-RESP' AS seg, panel_code, col_name, CAST(editable AS varchar(5)) AS editable, place
FROM yj_field WHERE panel_code IN ('QC_BHC','QC_BHZ','QC_SCP') AND col_name = N'责任人';
SELECT N'2-AUDIT' AS seg, panel_code, col_name, CAST(editable AS varchar(5)) AS editable
FROM yj_field WHERE panel_code IN ('QC_BHC','QC_BHZ','QC_SCP') AND col_name IN (N'审核人',N'审批人',N'审核时间',N'审批时间')
ORDER BY panel_code, col_name;
SELECT N'3-ROW' AS seg, 单据编号, 责任人, 审核人, 审批人 FROM qc_bhc ORDER BY id DESC;
