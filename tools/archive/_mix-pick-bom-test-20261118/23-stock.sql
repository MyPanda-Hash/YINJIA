SET NOCOUNT ON;
PRINT '--- 新补配方用到的物料:测试库有没有库存 ---';
SELECT m.物料编码, MAX(m.物料名) AS 物料名,
       ISNULL(SUM(s.现存量),0) AS 现存量合计,
       MAX(ISNULL(s.仓库,N'')) AS 示例仓,
       CASE WHEN ISNULL(SUM(s.现存量),0) > 0 THEN N'有库存' ELSE N'无库存(生单仓库预填为空)' END AS 状态
FROM (SELECT DISTINCT 子件编码 AS 物料编码, 子件名称 AS 物料名 FROM bs_asm_bom
      WHERE 来源 = N'测试库演示_混料配方套用_20261118') m
LEFT JOIN v_stock_pick s ON s.存货编码 = m.物料编码 AND s.现存量 > 0
GROUP BY m.物料编码
ORDER BY 状态, m.物料编码;
