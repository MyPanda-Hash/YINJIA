SET NOCOUNT ON;

-- 1. 批号口径在三个地方的分布:kucun / inh / outh
SELECT 来源 = 'kucun', 批号口径 =
    CASE WHEN lot_no IS NULL THEN '(NULL)' WHEN LTRIM(RTRIM(lot_no))='' THEN '(空串)'
         WHEN lot_no='PC0000' THEN 'PC0000' ELSE '真实批号' END,
    行数 = COUNT(*), 负行数 = SUM(CASE WHEN yl < 0 THEN 1 ELSE 0 END), 余量 = SUM(yl)
FROM kucun
GROUP BY CASE WHEN lot_no IS NULL THEN '(NULL)' WHEN LTRIM(RTRIM(lot_no))='' THEN '(空串)'
         WHEN lot_no='PC0000' THEN 'PC0000' ELSE '真实批号' END
UNION ALL
SELECT 'inh(有效)', CASE WHEN 批号 IS NULL THEN '(NULL)' WHEN LTRIM(RTRIM(批号))='' THEN '(空串)'
         WHEN 批号='PC0000' THEN 'PC0000' ELSE '真实批号' END,
       COUNT(*), 0, SUM(数量)
FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y'
GROUP BY CASE WHEN 批号 IS NULL THEN '(NULL)' WHEN LTRIM(RTRIM(批号))='' THEN '(空串)'
         WHEN 批号='PC0000' THEN 'PC0000' ELSE '真实批号' END
UNION ALL
SELECT 'outh(有效)', CASE WHEN 批号 IS NULL THEN '(NULL)' WHEN LTRIM(RTRIM(批号))='' THEN '(空串)'
         WHEN 批号='PC0000' THEN 'PC0000' ELSE '真实批号' END,
       COUNT(*), 0, SUM(数量)
FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y'
GROUP BY CASE WHEN 批号 IS NULL THEN '(NULL)' WHEN LTRIM(RTRIM(批号))='' THEN '(空串)'
         WHEN 批号='PC0000' THEN 'PC0000' ELSE '真实批号' END
ORDER BY 1, 2;

-- 2. 期初(src=0)负数量行:kucun 侧与流水侧的期初口径
SELECT 项 = 'inh src=0 全部行', 行数 = COUNT(*), 数量合计 = SUM(数量),
       负数量行 = SUM(CASE WHEN 数量 < 0 THEN 1 ELSE 0 END), 负数量合计 = SUM(CASE WHEN 数量 < 0 THEN 数量 ELSE 0 END)
FROM inh WHERE src = 0
UNION ALL
SELECT 'inh src=0 已冲销行', COUNT(*), SUM(数量), SUM(CASE WHEN 数量<0 THEN 1 ELSE 0 END), SUM(CASE WHEN 数量<0 THEN 数量 ELSE 0 END)
FROM inh WHERE src = 0 AND ISNULL(asp_cancel,'N') = 'Y';

-- 3. 期初负数量样例
SELECT TOP 15 单据编号, 物料编码, 仓库编码, 批号, 数量, 单据日期, asp_user1, asp_user2, asp_time1, asp_cancel
FROM inh WHERE src = 0 AND 数量 < 0 ORDER BY 数量;

-- 4. 最近 30 天流水按 src 与日期
SELECT src, 单据类型, 行数 = COUNT(*), 数量 = SUM(数量), 最早 = MIN(单据日期), 最晚 = MAX(单据日期)
FROM inh WHERE ISNULL(asp_cancel,'N') <> 'Y'
GROUP BY src, 单据类型 ORDER BY src;

SELECT src, 单据类型, 行数 = COUNT(*), 数量 = SUM(数量), 最早 = MIN(单据日期), 最晚 = MAX(单据日期)
FROM outh WHERE ISNULL(asp_cancel,'N') <> 'Y'
GROUP BY src, 单据类型 ORDER BY src;
