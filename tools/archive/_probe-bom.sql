USE HSDZ_MES; SET NOCOUNT ON;
SELECT c.name AS 列名, t.name AS 类型 FROM sys.columns c JOIN sys.types t ON t.user_type_id=c.user_type_id WHERE c.object_id=OBJECT_ID('bs_bom') ORDER BY c.column_id;
GO
SELECT N'总行数' AS 项, CAST(COUNT(*) AS nvarchar) AS 值 FROM bs_bom WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'不同父件数', CAST(COUNT(DISTINCT 父件编码) AS nvarchar) FROM bs_bom WHERE ISNULL(asp_cancel,'N')<>'Y'
UNION ALL SELECT N'子件编码为空的行', CAST(COUNT(*) AS nvarchar) FROM bs_bom WHERE ISNULL(asp_cancel,'N')<>'Y' AND (子件编码 IS NULL OR LTRIM(RTRIM(子件编码))=N'');
GO
SELECT TOP 12 父件编码, 父件名称, 版本号, 子件编码, 子件名称, 规格型号, 定额数量, 默认BOM
FROM bs_bom WHERE ISNULL(asp_cancel,'N')<>'Y' ORDER BY 父件编码, 子件编码;
GO
SELECT 父件编码, 父件名称, COUNT(*) AS 子件数 FROM bs_bom WHERE ISNULL(asp_cancel,'N')<>'Y' AND 子件编码 IS NOT NULL AND LTRIM(RTRIM(子件编码))<>N'' GROUP BY 父件编码, 父件名称 ORDER BY 子件数 DESC;
GO