USE HSDZ_MES; SET NOCOUNT ON;
SELECT TOP 8 父件编码, 父件名称, 子件编码, 子件名称, 物料种类, 物料规格, 外观要求, 定额数量
FROM bs_bom WHERE 父件编码 = N'T382' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id;
GO
SELECT TOP 6 父件编码, 父件名称, ISNULL(子件编码,N'(空)') AS 子件编码, ISNULL(子件名称,N'') AS 子件名称,
       ISNULL(物料种类,N'') AS 物料种类, ISNULL(物料规格,N'') AS 物料规格, ISNULL(外观要求,N'') AS 外观要求, 默认BOM
FROM bs_bom WHERE 父件编码 <> N'T382' AND ISNULL(asp_cancel,'N')<>'Y' ORDER BY id;
GO
SELECT 父件编码, 父件名称, COUNT(*) AS 行数, SUM(CASE WHEN 子件编码 IS NULL OR LTRIM(RTRIM(子件编码))=N'' THEN 1 ELSE 0 END) AS 空子件行
FROM bs_bom WHERE ISNULL(asp_cancel,'N')<>'Y' GROUP BY 父件编码, 父件名称 ORDER BY 行数 DESC;
GO