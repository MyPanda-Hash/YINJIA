SET NOCOUNT ON;
PRINT '=== 测试库:同日同料同批号的金蝶入库行 ===';
SELECT h.单据编号, h.单据日期, d.存货编码, d.批号, COUNT(*) OVER() AS 该组行数
  FROM bl_purchase_in d JOIN bd_purchase_in h ON h.单据编号 = d.单据编号
 WHERE d.存货编码 = N'A-32-01' AND d.批号 = N'20261009' AND ISNULL(d.asp_cancel,'N')<>'Y'
 ORDER BY h.单据编号;
PRINT '=== 全测试库:日期型原批号里是否存在同料同日的重复 ===';
SELECT COUNT(*) AS 冲突组数 FROM (
  SELECT d.存货编码, d.批号, h.单据日期 FROM bl_purchase_in d JOIN bd_purchase_in h ON h.单据编号=d.单据编号
   WHERE ISNULL(d.asp_cancel,'N')<>'Y' AND d.批号 LIKE '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'
   GROUP BY d.存货编码, d.批号, h.单据日期 HAVING COUNT(*)>1) x;
