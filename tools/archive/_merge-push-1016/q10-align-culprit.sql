-- q10-align-culprit.sql — 用 ISDATE(兼容级别 100 可用)定位「日期转换失败」的坏值(只读)
SET NOCOUNT ON;

PRINT '== 1. §2 涉及列的类型 ==';
SELECT t.name AS 表, c.name AS 列, ty.name AS 类型
FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.name IN (N'bd_pu_order',N'bd_so_order',N'bd_purchase_in',N'bd_sale_out',N'bd_material_out',
                 N'bd_finish_in',N'bd_other_in',N'bd_other_out',N'sl_recv',N'qc_insp')
  AND c.name IN (N'转ERP时间',N'创建时间',N'单据日期',N'审核时间',N'审批时间',N'检验日期')
ORDER BY t.name, c.name;

PRINT '== 2. 文本型「日期/时间」列里 ISDATE=0 的值(这些都会炸 CONVERT) ==';
DECLARE @sql nvarchar(max) = N'';
SELECT @sql = @sql + CASE WHEN @sql = N'' THEN N'' ELSE N' UNION ALL ' END
     + N'SELECT ''' + t.name + N''' AS 表, ''' + c.name + N''' AS 列, COUNT(*) AS 坏行数,'
     + N' MIN(LEFT([' + c.name + N'], 30)) AS 样例 FROM ' + QUOTENAME(t.name)
     + N' WHERE [' + c.name + N'] IS NOT NULL AND LTRIM(RTRIM([' + c.name + N'])) <> N'''''
     + N' AND ISDATE([' + c.name + N']) = 0'
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.is_ms_shipped = 0 AND ty.name IN (N'varchar', N'nvarchar', N'char', N'nchar')
  AND c.name IN (N'转ERP时间', N'创建时间', N'单据日期', N'审核时间', N'审批时间', N'检验日期')
  AND t.name IN (N'bd_pu_order',N'bd_so_order',N'bd_purchase_in',N'bd_sale_out',N'bd_material_out',
                 N'bd_finish_in',N'bd_other_in',N'bd_other_out',N'sl_recv',N'qc_insp')
  AND NOT EXISTS (SELECT 1 FROM sys.columns d WHERE d.object_id = t.object_id AND d.name = N'单据编号' AND 1 = 0);
IF @sql <> N'' EXEC sp_executesql @sql;

PRINT '== 3. 空串/空白 的日期列(sl_recv / qc_insp §3 自检会 CONVERT(date, 单据日期)) ==';
SELECT N'sl_recv.单据日期 空串' AS 项, COUNT(*) AS 行数 FROM sl_recv WHERE LTRIM(RTRIM(ISNULL(单据日期, N''))) = N''
UNION ALL SELECT N'qc_insp.单据日期 空串', COUNT(*) FROM qc_insp WHERE LTRIM(RTRIM(ISNULL(单据日期, N''))) = N''
UNION ALL SELECT N'bd_pu_order.单据日期 空串', COUNT(*) FROM bd_pu_order WHERE LTRIM(RTRIM(ISNULL(单据日期, N''))) = N''
UNION ALL SELECT N'sl_recv.审核时间 非空且ISDATE=0', COUNT(*) FROM sl_recv WHERE ISNULL(审核时间,'')<>'' AND ISDATE(审核时间)=0
UNION ALL SELECT N'qc_insp.审核时间 非空且ISDATE=0', COUNT(*) FROM qc_insp WHERE ISNULL(审核时间,'')<>'' AND ISDATE(审核时间)=0
UNION ALL SELECT N'qc_insp.检验日期 非空且ISDATE=0', COUNT(*) FROM qc_insp WHERE ISNULL(检验日期,'')<>'' AND ISDATE(检验日期)=0;
