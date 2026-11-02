SET NOCOUNT ON;
-- 1. 一切 INIT 前缀流水(含已冲销)
SELECT 单据编号, 单据类型, src, 行数 = COUNT(*), 数量 = SUM(数量),
       冲销行 = SUM(CASE WHEN ISNULL(asp_cancel,'N')='Y' THEN 1 ELSE 0 END),
       写入者 = MIN(asp_user1), 写入时间 = MIN(asp_time1), 最晚 = MAX(asp_time1)
FROM inh WHERE 单据编号 LIKE 'INIT%' GROUP BY 单据编号, 单据类型, src;

-- 2. 所有 src=0 行的单据编号清单(含结转)
SELECT 单据编号, 单据类型, 行数 = COUNT(*), 数量 = SUM(数量), 写入者 = MIN(asp_user1),
       写入时间 = MIN(asp_time1)
FROM inh WHERE src = 0 GROUP BY 单据编号, 单据类型 ORDER BY 写入时间;

-- 3. kucun 的来源标记全景
SELECT 来源 = ISNULL(asp_user1,'<NULL>'), 二次标记 = ISNULL(asp_user2,'<NULL>'),
       行数 = COUNT(*), 余量 = SUM(yl), 负行数 = SUM(CASE WHEN yl<0 THEN 1 ELSE 0 END),
       时间 = CONVERT(char(16), MIN(asp_time1), 120) + ' ~ ' + CONVERT(char(16), MAX(asp_time1), 120)
FROM kucun GROUP BY ISNULL(asp_user1,'<NULL>'), ISNULL(asp_user2,'<NULL>') ORDER BY 行数 DESC;

-- 4. 库级别:HSDZ_MES 与 服务器备份还原库 的库存三表行数对照
-- 注:与服务器备份还原库(HSDZ_MES_SRV1021)的逐表对照需要 sa;
--     yinjia 账号无权跨库读,故这里只出自库数字;服务器侧数字见
--     tools/archive/_srv1021-vs-local-20261021/raw-02-data-diff-full.txt(inh/outh/kucun 逐表同数)
SELECT 对象 = 'inh', 行数 = COUNT(*) FROM inh
UNION ALL SELECT 'outh', COUNT(*) FROM outh
UNION ALL SELECT 'kucun', COUNT(*) FROM kucun
UNION ALL SELECT 'kucun 负行', COUNT(*) FROM kucun WHERE yl < 0
UNION ALL SELECT 'kucun Σyl', CAST(ISNULL(SUM(yl),0) AS decimal(18,4)) FROM kucun
UNION ALL SELECT 'inh INIT 行', COUNT(*) FROM inh WHERE 单据编号 LIKE 'INIT%';
