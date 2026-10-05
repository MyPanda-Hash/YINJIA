SET NOCOUNT ON;
GO
SELECT TOP 10 N'⑤ 暂收单明细 数量 vs 入库数量 样本' AS 区块, d.单据编号, d.物料编码, d.数量, d.入库数量, d.剩余数量
FROM sl_recv_detail d ORDER BY d.id DESC;
GO
SELECT N'⑥ 列存在性' AS 区块,
       COL_LENGTH('dbo.bl_purchase_in', N'是否来料检验') AS 入库行标志列,
       COL_LENGTH('dbo.qc_insp_detail', N'送检数量') AS 检验行送检数量列;
GO
SELECT N'⑦ 来料检验=是 的商品' AS 区块, 存货编码, 存货名称, 来料检验 FROM bs_inv WHERE 来料检验 = N'是';
GO
SELECT N'⑧ QC_RECV 明细 yj_field 全量(可见)' AS 区块, col_name, label, place, seq, visible FROM yj_field WHERE panel_code='QC_RECV' AND place LIKE '%detail%' AND visible=1 ORDER BY seq;
GO
