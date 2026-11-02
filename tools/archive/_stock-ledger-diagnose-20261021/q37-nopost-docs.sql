SET NOCOUNT ON;
-- 单据级:哪些已审核出库单在 outh 里一行都没有(按单号)
IF OBJECT_ID('tempdb..#line') IS NOT NULL DROP TABLE #line;
SELECT 单号 = 单据编号, 行数 = COUNT(*) INTO #line FROM bl_material_out GROUP BY 单据编号;

IF OBJECT_ID('tempdb..#mout') IS NOT NULL DROP TABLE #mout;
SELECT 单号 = 单据编号, 流水行 = COUNT(*) INTO #mout FROM outh GROUP BY 单据编号;

IF OBJECT_ID('tempdb..#fline') IS NOT NULL DROP TABLE #fline;
SELECT 单号 = 单据编号, 行数 = COUNT(*) INTO #fline FROM bl_finish_in GROUP BY 单据编号;

IF OBJECT_ID('tempdb..#fin') IS NOT NULL DROP TABLE #fin;
SELECT 单号 = 单据编号, 流水行 = COUNT(*) INTO #fin FROM inh WHERE src = 2 GROUP BY 单据编号;

SELECT 情形 = CASE WHEN m.流水行 IS NULL THEN '整单没流水'
                   WHEN m.流水行 < l.行数 THEN '部分行没流水'
                   ELSE '齐全' END,
       单数 = COUNT(*), 行数合计 = SUM(l.行数), 流水行合计 = SUM(ISNULL(m.流水行,0))
FROM bd_material_out h JOIN #line l ON l.单号 = h.单据编号 LEFT JOIN #mout m ON m.单号 = h.单据编号
WHERE h.单据状态 = N'已审核'
GROUP BY CASE WHEN m.流水行 IS NULL THEN '整单没流水'
              WHEN m.流水行 < l.行数 THEN '部分行没流水'
              ELSE '齐全' END;

SELECT TOP 10 h.单据编号, h.单据日期, l.行数, 流水行 = ISNULL(m.流水行,0)
FROM bd_material_out h JOIN #line l ON l.单号 = h.单据编号 LEFT JOIN #mout m ON m.单号 = h.单据编号
WHERE h.单据状态 = N'已审核' AND m.流水行 IS NULL
ORDER BY h.单据日期 DESC;

-- 按"库内写入日期"分组:哪一批进来后没过账
SELECT 写入日 = CONVERT(char(10), h.asp_time1, 120), 已审核单数 = COUNT(*),
       整单无流水 = SUM(CASE WHEN m.流水行 IS NULL THEN 1 ELSE 0 END)
FROM bd_material_out h LEFT JOIN #mout m ON m.单号 = h.单据编号
WHERE h.单据状态 = N'已审核'
GROUP BY CONVERT(char(10), h.asp_time1, 120) ORDER BY 1;

-- 产成品入库同口径
SELECT 写入日 = CONVERT(char(10), h.asp_time1, 120), 已审核单数 = COUNT(*),
       整单无流水 = SUM(CASE WHEN m.流水行 IS NULL THEN 1 ELSE 0 END)
FROM bd_finish_in h LEFT JOIN #fin m ON m.单号 = h.单据编号
WHERE h.单据状态 = N'已审核'
GROUP BY CONVERT(char(10), h.asp_time1, 120) ORDER BY 1;
