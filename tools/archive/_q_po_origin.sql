-- _q_po_origin.sql — 采购订单来源构成(MES 自建 vs 金蝶同步):决定「推订单号」是否指向金蝶真实存在的单
SET NOCOUNT ON;
PRINT '── 采购订单单号形态分布 ──';
SELECT CASE WHEN 单据编号 LIKE 'YJ-%' THEN 'YJ-(金蝶样式)'
            WHEN 单据编号 LIKE 'PO%' THEN 'PO-(MES 前缀)'
            WHEN 单据编号 LIKE 'ZXL%' THEN 'ZXL-(金蝶星辰)'
            ELSE '其它' END AS 单号形态,
       COUNT(*) AS 单数, MIN(单据编号) AS 样例1, MAX(单据编号) AS 样例2
FROM bd_pu_order GROUP BY CASE WHEN 单据编号 LIKE 'YJ-%' THEN 'YJ-(金蝶样式)'
            WHEN 单据编号 LIKE 'PO%' THEN 'PO-(MES 前缀)'
            WHEN 单据编号 LIKE 'ZXL%' THEN 'ZXL-(金蝶星辰)'
            ELSE '其它' END;
GO
PRINT '── 采购订单:是否金蝶同步来源(yj_doc_status.shr / 留痕) ──';
SELECT TOP 10 o.单据编号, o.单据日期, o.供应商, s.shr, s.doc_status
FROM bd_pu_order o LEFT JOIN yj_doc_status s ON s.panel_code='PU_ORDER' AND s.doc_no=o.单据编号
ORDER BY o.id DESC;
GO
PRINT '── 采购入库单里的采购订单号是否真在采购订单表里 ──';
SELECT i.单据编号 AS 入库单, i.采购订单号, CASE WHEN EXISTS (SELECT 1 FROM bd_pu_order o WHERE o.单据编号=i.采购订单号) THEN '本地订单存在' ELSE '本地订单不存在' END AS 本地核对
FROM bd_purchase_in i WHERE ISNULL(i.采购订单号,'')<>'';
GO
