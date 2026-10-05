-- 临时探针:回填后核对「来料检验 未填写=否」(两账套各跑一次)
SET NOCOUNT ON;
SELECT DB_NAME() AS 库,
       COUNT(*) AS 总行,
       SUM(CASE WHEN 来料检验 = N'是' THEN 1 ELSE 0 END) AS 是,
       SUM(CASE WHEN 来料检验 = N'否' THEN 1 ELSE 0 END) AS 否,
       SUM(CASE WHEN 来料检验 IS NULL OR LTRIM(RTRIM(来料检验)) = N'' THEN 1 ELSE 0 END) AS 仍为空,
       SUM(CASE WHEN 来料检验 IS NOT NULL AND LTRIM(RTRIM(来料检验)) <> N'' AND 来料检验 NOT IN (N'是', N'否') THEN 1 ELSE 0 END) AS 其它取值
FROM bs_inv;

SELECT TOP 12 存货编码, 存货名称, 来料检验, CASE WHEN 外部数据ID IS NULL THEN N'本地手录' ELSE N'金蝶同步' END AS 来源
FROM bs_inv WHERE 来料检验 = N'是' ORDER BY 存货编码;

SELECT CAST(ep.value AS nvarchar(300)) AS 列注明
FROM sys.extended_properties ep
WHERE ep.major_id = OBJECT_ID('dbo.bs_inv')
  AND ep.minor_id = COLUMNPROPERTY(OBJECT_ID('dbo.bs_inv'), N'来料检验', 'ColumnId')
  AND ep.name = N'MS_Description';
