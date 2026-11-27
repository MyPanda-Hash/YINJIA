SELECT 单据编号, 物料编码, 送检数量, 合格数量, 不合格数量, 特采, 入库单号 FROM qc_insp_detail WHERE 单据编号 = N'IJ-2026-11-0007';
GO
SELECT b.单据编号, b.供应商, b.来源单据, b.来源单号, l.存货编码, l.实收数量, l.特采, l.是否来料检验
FROM bd_purchase_in b JOIN bl_purchase_in l ON l.单据编号 = b.单据编号
WHERE ISNULL(b.asp_cancel,'N') <> 'Y' AND b.来源单号 IN (N'TCI-2026-11-0007', N'IJ-2026-11-0007')
ORDER BY b.id DESC;
GO
SELECT source_panel_code, source_form_no, source_line_key, target_panel_code, target_form_no, linked_quantity, 备用1, 备用2
FROM form_flow_link WHERE create_time > DATEADD(hour,-1,GETDATE()) ORDER BY id DESC;
GO
SELECT r.单据编号, r.检验结论, r.不合格品处理单号 FROM qc_insp_rec r WHERE r.单据编号 = N'JYSJ-2026-11-0021';
