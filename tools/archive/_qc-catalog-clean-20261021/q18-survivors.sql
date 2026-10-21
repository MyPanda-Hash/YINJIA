SET NOCOUNT ON;
SELECT r.单据编号 rec, r.物料编码, r.物料批次, r.来料数量, r.计量单位, r.来料检验单号,
       dt.批次号 dt_batch, dt.送检数量, dt.单位, dt.计量单位 dt_unit, dt.物料名称
FROM qc_insp_rec r
JOIN qc_insp h ON h.单据编号=r.来料检验单号 AND ISNULL(h.asp_cancel,'N')<>'Y'
JOIN qc_insp_detail dt ON dt.单据编号=h.单据编号 AND dt.物料编码=r.物料编码 AND ISNULL(dt.asp_cancel,'N')<>'Y'
WHERE ISNULL(r.asp_cancel,'N')<>'Y' ORDER BY r.单据编号;
GO
SELECT 存货编码, 所属类别 FROM bs_inv WHERE 存货编码='YJ-KBL-021';
