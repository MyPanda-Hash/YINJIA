/* 只读复核:送样登记表内部检测目录 2026-11-19 版(用 A1 第 4 步 / 验收取证)
   证据点:1) 在册 55 行 2)「硬度」已作废 3)「色度」收费为空 4)「外送部分」存在 5) 字段已改名
   只读:全部 SELECT / DECLARE,无任何写库语句。
   注:SqlRunner 不转发 PRINT,故每段结果都带「标签」列做分节。*/
SET NOCOUNT ON;

SELECT N'[0] 数据库' AS 标签, DB_NAME() AS 值;

SELECT N'[1] 在册/作废行数' AS 标签,
       CAST(COUNT(*) AS nvarchar(20)) AS 总行数,
       CAST(COUNT(CASE WHEN ISNULL(asp_cancel, N'N') <> N'Y' THEN 1 END) AS nvarchar(20)) AS 在册,
       CAST(COUNT(CASE WHEN asp_cancel = N'Y' THEN 1 END) AS nvarchar(20)) AS 已作废
FROM dbo.qc_sample_reg;

SELECT N'[2] 旧项硬度' AS 标签, CAST(序号 AS nvarchar(10)) AS 序号, 检测元素,
       ISNULL(asp_cancel, N'(null)') AS 作废, ISNULL(asp_user2, N'(null)') AS 作废人
FROM dbo.qc_sample_reg WHERE 检测元素 = N'硬度';

SELECT N'[3] 代表项' AS 标签, CAST(序号 AS nvarchar(10)) AS 序号, 检测元素,
       内部检出限 AS 检出限, 测试方法, 测试周期, ISNULL(CAST(收费 AS nvarchar(20)), N'(空)') AS 收费,
       检测标准, 检测标准备注, ISNULL(备注, N'(空)') AS 备注, ISNULL(asp_cancel, N'(null)') AS 作废
FROM dbo.qc_sample_reg
WHERE 检测元素 IN (N'总硬度', N'色度', N'外送部分')
ORDER BY ISNULL(序号, 999);

SELECT N'[4] 色度:收费/方法为空数' AS 标签,
       CAST(COUNT(*) AS nvarchar(10)) AS 行数,
       CAST(COUNT(CASE WHEN 收费 IS NULL OR 收费 = 0 THEN 1 END) AS nvarchar(10)) AS 收费为空,
       CAST(COUNT(CASE WHEN ISNULL(测试方法, N'') = N'' THEN 1 END) AS nvarchar(10)) AS 方法为空
FROM dbo.qc_sample_reg WHERE 检测元素 = N'色度' AND ISNULL(asp_cancel, N'N') <> N'Y';

SELECT N'[5] 在册目录' AS 标签, CAST(序号 AS nvarchar(10)) AS 序号, 检测元素,
       内部检出限 AS 检出限, 测试方法, 测试周期, ISNULL(CAST(收费 AS nvarchar(20)), N'(空)') AS 收费, 检测标准
FROM dbo.qc_sample_reg
WHERE ISNULL(asp_cancel, N'N') <> N'Y'
ORDER BY ISNULL(序号, 999), 检测元素;

SELECT N'[6] 字段改名' AS 标签, panel_code, label, col_name, CAST(seq AS nvarchar(10)) AS seq, place
FROM yj_field
WHERE col_name = N'内部检出限' AND panel_code IN (N'SAMPLE_REG', N'INSP_COMMISSION')
ORDER BY panel_code, seq;

SELECT N'[7] 译名' AS 标签, scope, ref_key, locale, text, source FROM yj_translation
WHERE ref_key IN (N'标准方法检出限', N'内部检测目录')
ORDER BY ref_key, locale;

SELECT N'[8] 重复序号(期望 0 行)' AS 标签, CAST(序号 AS nvarchar(10)) AS 序号,
       CAST(COUNT(*) AS nvarchar(10)) AS 行数, STRING_AGG(检测元素, N' / ') AS 元素
FROM dbo.qc_sample_reg WHERE ISNULL(asp_cancel, N'N') <> N'Y'
GROUP BY 序号 HAVING COUNT(*) > 1;
