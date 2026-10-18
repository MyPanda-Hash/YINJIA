SET NOCOUNT ON;
PRINT N'== outh 按 src × 单据类型 × 单号前缀 分布(本地)==';
SELECT src, 单据类型, LEFT(单据编号,2) AS 前缀, COUNT(*) 行数, COUNT(DISTINCT 单据编号) 单数
  FROM dbo.outh GROUP BY src, 单据类型, LEFT(单据编号,2) ORDER BY src, 行数 DESC;
PRINT N'== outh 中找不到对应材料出库单头的行(外部写入嫌疑)==';
SELECT src, 单据类型, COUNT(*) 行数 FROM dbo.outh o
 WHERE NOT EXISTS (SELECT 1 FROM bd_material_out h WHERE h.单据编号 = o.单据编号)
   AND NOT EXISTS (SELECT 1 FROM bd_sale_out h WHERE h.单据编号 = o.单据编号)
   AND NOT EXISTS (SELECT 1 FROM bd_other_out h WHERE h.单据编号 = o.单据编号)
 GROUP BY src, 单据类型;
PRINT N'== inh 按 src × 单据类型 × 前缀 分布 ==';
SELECT src, 单据类型, LEFT(单据编号,2) AS 前缀, COUNT(*) 行数, COUNT(DISTINCT 单据编号) 单数
  FROM dbo.inh GROUP BY src, 单据类型, LEFT(单据编号,2) ORDER BY src, 行数 DESC;
