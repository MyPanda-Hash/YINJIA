SET NOCOUNT ON;

-- A. 流水写入批次分布(谁在什么时候写了哪些流水)
SELECT 表名='inh', 写入日 = CONVERT(char(10), asp_time1, 120), 写入者 = ISNULL(asp_user1,'<NULL>'),
       单据类型, 行数 = COUNT(*), 数量 = SUM(数量), 最早单据日 = MIN(单据日期), 最晚单据日 = MAX(单据日期)
FROM inh GROUP BY CONVERT(char(10), asp_time1, 120), ISNULL(asp_user1,'<NULL>'), 单据类型
UNION ALL
SELECT 'outh', CONVERT(char(10), asp_time1, 120), ISNULL(asp_user1,'<NULL>'), 单据类型, COUNT(*), SUM(数量), MIN(单据日期), MAX(单据日期)
FROM outh GROUP BY CONVERT(char(10), asp_time1, 120), ISNULL(asp_user1,'<NULL>'), 单据类型
ORDER BY 1, 2, 3;

-- B. 结存缓存写入批次
SELECT 写入日 = CONVERT(char(10), asp_time1, 120), 写入者 = ISNULL(asp_user1,'<NULL>'),
       行数 = COUNT(*), 余量 = SUM(yl), 负行数 = SUM(CASE WHEN yl<0 THEN 1 ELSE 0 END)
FROM kucun GROUP BY CONVERT(char(10), asp_time1, 120), ISNULL(asp_user1,'<NULL>') ORDER BY 1,2;

-- C. 期初行(src=0 期初结存)现状
SELECT 行数 = COUNT(*), 数量 = SUM(数量), 最早单据日 = MIN(单据日期), 最晚单据日 = MAX(单据日期),
       写入日 = CONVERT(char(10), MIN(asp_time1), 120) + ' ~ ' + CONVERT(char(10), MAX(asp_time1), 120),
       编号样例 = MIN(单据编号)
FROM inh WHERE src = 0 AND 单据类型 = N'期初结存';

-- D. 按月看流水(src=0 期初除外)
SELECT 月 = CONVERT(char(7), 单据日期, 120), 方向='入', 行数=COUNT(*), 数量=SUM(数量)
FROM inh WHERE ISNULL(asp_cancel,'N')<>'Y' AND 单据类型 <> N'月结结转' AND 单据日期 >= '2000-01-01'
GROUP BY CONVERT(char(7), 单据日期, 120)
UNION ALL
SELECT CONVERT(char(7), 单据日期, 120), '出', COUNT(*), SUM(数量)
FROM outh WHERE ISNULL(asp_cancel,'N')<>'Y'
GROUP BY CONVERT(char(7), 单据日期, 120)
ORDER BY 1, 2;

-- E. 异常日期单据(未来日期/哨兵)
SELECT 方向='入', 单据编号, 单据类型, 单据日期, 行数=COUNT(*) FROM inh GROUP BY 单据编号, 单据类型, 单据日期 HAVING 单据日期 > '2026-12-31' OR 单据日期 < '2000-01-01'
UNION ALL
SELECT '出', 单据编号, 单据类型, 单据日期, COUNT(*) FROM outh GROUP BY 单据编号, 单据类型, 单据日期 HAVING 单据日期 > '2026-12-31' OR 单据日期 < '2000-01-01'
ORDER BY 1,4;
