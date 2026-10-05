SET NOCOUNT ON;
GO
SELECT N'① QC_RECV 表头字段' AS 区块, col_name, label, place, seq FROM yj_field WHERE panel_code='QC_RECV' AND place LIKE '%header%' ORDER BY seq;
GO
SELECT N'② PURCHASE_IN 明细(编码/数量/来料检验)' AS 区块, col_name, label, place, seq FROM yj_field WHERE panel_code='PURCHASE_IN' AND place LIKE '%detail%' AND (col_name IN (N'物料编码',N'存货编码',N'实收数量',N'数量',N'是否来料检验',N'批次号',N'批次键')) ORDER BY seq;
GO
SELECT N'③ 历史上检验单的暂收单号取值' AS 区块, TOP 8 单据编号, 暂收单号, 采购订单号, 批次号 FROM qc_insp ORDER BY id DESC;
GO
