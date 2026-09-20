-- _q_po_flow.sql — 采购订单号在 MES 单据链上的携带情况(推到金蝶的前置数据)
SET NOCOUNT ON;
PRINT '── 1) 采购入库头:有采购订单号的单据 ──';
SELECT 单据编号, 单据日期, 供应商, 采购订单号, 来源单据, 来源单号, 销售订单号, ERP单号
FROM bd_purchase_in WHERE ISNULL(采购订单号,'')<>'';
GO
PRINT '── 2) 链上各单据是否带采购订单号(列存在性+有值数) ──';
SELECT 'SL_RECV.头' AS 表, (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='sl_recv' AND COLUMN_NAME=N'采购订单号') AS 列存在
UNION ALL SELECT 'QC_INSP.头', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='qc_insp' AND COLUMN_NAME=N'采购订单号')
UNION ALL SELECT 'bd_purchase_in.头', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bd_purchase_in' AND COLUMN_NAME=N'采购订单号')
UNION ALL SELECT 'bl_purchase_in.行_源单编号', (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='bl_purchase_in' AND COLUMN_NAME=N'源单编号');
GO
PRINT '── 3) 送料暂收/来料检验 头里的采购订单号有值数 ──';
SELECT 'sl_recv' AS 表, COUNT(*) AS 单数, SUM(CASE WHEN ISNULL(采购订单号,'')<>'' THEN 1 ELSE 0 END) AS 有采购订单号 FROM sl_recv
UNION ALL SELECT 'qc_insp', COUNT(*), SUM(CASE WHEN ISNULL(采购订单号,'')<>'' THEN 1 ELSE 0 END) FROM qc_insp;
GO
PRINT '── 4) 采购订单号候选来源:采购订单(mes 自建/金蝶同步)头单号样式 ──';
SELECT TOP 8 单据编号, 单据日期, 供应商, 单据状态 FROM bd_pu_order ORDER BY id DESC;
GO
PRINT '── 5) 采购入库行 源单编号/源单行号 有值的行 ──';
SELECT 单据编号, 行号, 商品编码, 实收数量, 基本数量, 源单编号, 源单行号, 是否来料检验 FROM bl_purchase_in
WHERE ISNULL(源单编号,'')<>'' OR ISNULL(源单行号,'')<>'';
GO
