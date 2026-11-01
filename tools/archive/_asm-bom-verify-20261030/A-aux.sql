SET NOCOUNT ON;
SELECT 'A1-列定义' AS what, c.name AS col, t.name AS typ, c.max_length, c.precision, c.scale, c.is_nullable,
       c.column_id, CASE WHEN c.is_identity = 1 THEN 'IDENTITY' ELSE '' END AS ident
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE c.object_id = OBJECT_ID('dbo.bs_asm_bom') AND c.name IN (N'id', N'asp_user1', N'asp_time1', N'asp_user2', N'asp_time2', N'asp_cancel')
ORDER BY c.column_id;
GO
SELECT 'B6-空计量单位全清单' AS what, 单据编号, 行序, 子件编码, 子件名称, 计量单位
FROM bs_asm_bom WHERE 计量单位 IS NULL OR LTRIM(RTRIM(计量单位)) = '' ORDER BY 单据编号, 行序;
GO
SELECT 'B6-空计量单位子件' AS what, 子件编码, COUNT(*) AS cnt
FROM bs_asm_bom WHERE 计量单位 IS NULL OR LTRIM(RTRIM(计量单位)) = '' GROUP BY 子件编码;
GO
