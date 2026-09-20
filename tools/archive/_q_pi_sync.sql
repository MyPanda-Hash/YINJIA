-- _q_pi_sync.sql — 采购入库单在 MES 的同步/数据现状(五点字段的落数情况)
SET NOCOUNT ON;
PRINT '── 1) 采购入库头/行数据量 ──';
SELECT (SELECT COUNT(*) FROM bd_purchase_in) AS 头行数, (SELECT COUNT(*) FROM bl_purchase_in) AS 行行数;
GO
PRINT '── 2) 采购入库:头五字段有值率 ──';
SELECT COUNT(*) AS 总行,
       SUM(CASE WHEN ISNULL(采购订单号,'')<>'' THEN 1 ELSE 0 END) AS 采购订单号有值,
       SUM(CASE WHEN ISNULL(客户,'')<>'' THEN 1 ELSE 0 END) AS 客户有值,
       SUM(CASE WHEN ISNULL(来源单号,'')<>'' THEN 1 ELSE 0 END) AS 来源单号有值,
       SUM(CASE WHEN ISNULL(销售订单号,'')<>'' THEN 1 ELSE 0 END) AS 销售订单号有值
FROM bd_purchase_in;
GO
PRINT '── 3) 采购入库行:源单/检验 有值率 ──';
SELECT COUNT(*) AS 总行,
       SUM(CASE WHEN ISNULL(源单编号,'')<>'' THEN 1 ELSE 0 END) AS 源单编号有值,
       SUM(CASE WHEN ISNULL(源单行号,'')<>'' THEN 1 ELSE 0 END) AS 源单行号有值,
       SUM(CASE WHEN ISNULL(是否来料检验,'')<>'' THEN 1 ELSE 0 END) AS 是否来料检验有值,
       SUM(CASE WHEN ISNULL(基本数量,'')<>'' THEN 1 ELSE 0 END) AS 基本数量有值
FROM bl_purchase_in;
GO
PRINT '── 4) 采购订单行:基本数量/行号(供 join 取「订单基本数量」) ──';
SELECT COUNT(*) AS 采购订单行数,
       SUM(CASE WHEN ISNULL(基本数量,'')<>'' THEN 1 ELSE 0 END) AS 基本数量有值,
       SUM(CASE WHEN ISNULL(行号,'')<>'' THEN 1 ELSE 0 END) AS 行号有值
FROM bl_pu_order;
GO
PRINT '── 5) 样例:采购入库行 join 采购订单行(看能不能对上) ──';
SELECT TOP 5 i.单据编号, i.源单编号, i.源单行号, i.商品编码, i.数量, o.单据编号 AS 订单单号, o.行号 AS 订单行号, o.基本数量 AS 订单基本数量
FROM bl_purchase_in i
LEFT JOIN bl_pu_order o ON o.单据编号 = i.源单编号 AND CAST(o.行号 AS nvarchar(20)) = CAST(i.源单行号 AS nvarchar(20))
WHERE ISNULL(i.源单编号,'')<>'' ;
GO
PRINT '── 6) 样例:采购入库头/行前 3 行全貌(关键列) ──';
SELECT TOP 3 * FROM bd_purchase_in ORDER BY id DESC;
GO
SELECT TOP 3 单据编号,行号,商品编码,商品名称,数量,基本数量,是否来料检验,源单编号,源单行号 FROM bl_purchase_in ORDER BY id DESC;
GO
