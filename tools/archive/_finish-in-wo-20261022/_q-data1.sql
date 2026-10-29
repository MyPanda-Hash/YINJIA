SET NOCOUNT ON;
SELECT '=== 唯一一条有加工单号的入库单 ===' AS s;
SELECT TOP 5 h.id, h.单据编号, h.单据日期, h.加工单号, h.批次号, h.工单行号, h.单据类型, h.单据状态,
       h.asp_user1, h.asp_time1
  FROM dbo.bd_finish_in h
 WHERE ISNULL(h.加工单号, N'') <> N'';
SELECT '--- 它的明细 ---' AS s;
SELECT l.id, l.单据编号, l.产品编码, l.批号, l.实收数量, l.序号
  FROM dbo.bl_finish_in l
 WHERE l.单据编号 IN (SELECT 单据编号 FROM dbo.bd_finish_in WHERE ISNULL(加工单号, N'') <> N'');

SELECT '=== 231 条空加工单号：按年份/单据类型分布 ===' AS s;
SELECT YEAR(h.单据日期) AS 年, h.单据类型, h.单据状态, COUNT(*) AS 单数,
       SUM(CASE WHEN ISNULL(h.批次号, N'') <> N'' THEN 1 ELSE 0 END) AS 有批次号,
       SUM(CASE WHEN h.工单行号 IS NOT NULL THEN 1 ELSE 0 END) AS 有工单行号
  FROM dbo.bd_finish_in h
 WHERE ISNULL(h.加工单号, N'') = N''
 GROUP BY YEAR(h.单据日期), h.单据类型, h.单据状态
 ORDER BY 年, h.单据类型;

SELECT '=== 空单前 8 条样例(含明细) ===' AS s;
SELECT TOP 8 h.id, h.单据编号, h.单据日期, h.批次号, h.工单行号, h.单据类型, h.asp_user1,
       (SELECT TOP 3 CONCAT(l.产品编码, N'/', ISNULL(l.批号, N'-'), N'×', l.实收数量) + N' '
          FROM dbo.bl_finish_in l WHERE l.单据编号 = h.单据编号 ORDER BY l.id
          FOR XML PATH('')) AS 明细
  FROM dbo.bd_finish_in h
 WHERE ISNULL(h.加工单号, N'') = N''
 ORDER BY h.单据日期 DESC, h.id DESC;
