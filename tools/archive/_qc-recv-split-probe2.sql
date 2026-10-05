SET NOCOUNT ON;
GO
SELECT N'① QC_RECV 明细数量类字段' AS 区块, col_name, label, data_type, place, seq, editable, hidden, visible
FROM yj_field WHERE panel_code = 'QC_RECV' AND (label LIKE N'%数量%' OR col_name LIKE N'%数量%')
ORDER BY seq;
GO
SELECT N'② QC_INSP 明细数量类字段' AS 区块, col_name, label, data_type, place, seq
FROM yj_field WHERE panel_code = 'QC_INSP' AND (label LIKE N'%数量%')
ORDER BY seq;
GO
SELECT N'③ PURCHASE_IN 明细数量类字段' AS 区块, col_name, label, data_type, place, seq
FROM yj_field WHERE panel_code = 'PURCHASE_IN' AND (label LIKE N'%数量%')
ORDER BY seq;
GO
SELECT N'④ 暂收明细里未被商品档案匹配到的行' AS 区块, d.单据编号, N'[' + ISNULL(d.物料编码, N'<NULL>') + N']' AS 物料编码, d.物料名称, d.数量
FROM sl_recv_detail d LEFT JOIN bs_inv i ON i.存货编码 = d.物料编码
WHERE i.存货编码 IS NULL;
GO
SELECT N'⑤ 暂收单明细 数量 vs 入库数量 样本' AS 区块, TOP 10 d.单据编号, d.物料编码, d.数量, d.入库数量, d.剩余数量
FROM sl_recv_detail d ORDER BY d.id DESC;
GO
SELECT N'⑥ 已有检验单/入库单是否有 是否来料检验 列' AS 区块,
       COL_LENGTH('dbo.bl_purchase_in', N'是否来料检验') AS 入库行标志列,
       COL_LENGTH('dbo.qc_insp_detail', N'送检数量') AS 检验行送检数量列;
GO
SELECT N'⑦ 来料检验=是 的商品' AS 区块, 存货编码, 存货名称, 来料检验 FROM bs_inv WHERE 来料检验 = N'是';
GO
