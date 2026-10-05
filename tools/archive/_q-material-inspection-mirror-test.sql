-- 临时探针:把正式库(HSDZ_MES)商品·来料检验的值镜像到测试库(HSDZ_MES_TEST) —— 两账套数据口径一致
-- 背景:来料检验是金蝶自定义字段,同步器(config.database=HSDZ_MES)只写正式账套;
--      测试库(演示/试用)是正式库某时点快照,按存货编码补一次同值即可(幂等,可重跑)。
-- 用法:在 HSDZ_MES_TEST 上执行(jdbc ...;databaseName=HSDZ_MES_TEST)。
SET NOCOUNT ON;

UPDATE t SET t.来料检验 = s.来料检验
FROM bs_inv AS t
JOIN HSDZ_MES.dbo.bs_inv AS s ON s.存货编码 = t.存货编码
WHERE s.来料检验 IS NOT NULL AND LTRIM(RTRIM(s.来料检验)) <> N''
  AND ISNULL(t.来料检验, N'') <> s.来料检验;

SELECT N'测试库 来料检验 非空行' AS 项, CAST(COUNT(*) AS nvarchar(20)) AS 值
FROM bs_inv WHERE 来料检验 IS NOT NULL AND LTRIM(RTRIM(来料检验)) <> N'';
