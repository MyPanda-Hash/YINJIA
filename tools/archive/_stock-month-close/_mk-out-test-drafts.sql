-- _mk-out-test-drafts.sql(一次性:在测试库复制出两张草稿单,供预警拦截测试)
-- 思路:整单复制现役「已审核」单的头 + 行 ⇒ 所有派生字段(仓库名称/仓库id/商品列/单位/行号)天然完整,
--       只换 单据编号 与 单据日期(状态列写草稿;真正的审核态在 yj_doc_status,副本没有该行 ⇒ 未审核)。
-- 幂等:单号已存在就跳过。
SET NOCOUNT ON;

DECLARE @src sysname, @new sysname, @head sysname, @line sysname, @cols nvarchar(max), @sql nvarchar(max);

/* ---------- ① 材料出库单 ---------- */
SET @head = N'bd_material_out'; SET @line = N'bl_material_out';
SET @new = N'CL-TEST-0001';
IF NOT EXISTS (SELECT 1 FROM bd_material_out WHERE 单据编号 = @new)
BEGIN
  SELECT TOP 1 @src = 单据编号 FROM bd_material_out WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id DESC;
  IF @src IS NOT NULL
  BEGIN
    SELECT @cols = STUFF((SELECT N', ' + QUOTENAME(c.name) FROM sys.columns c
       WHERE c.object_id = OBJECT_ID(@head) AND c.name <> N'id' AND c.name NOT IN (N'单据编号', N'单据日期', N'单据状态')
       ORDER BY c.column_id FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N'');
    SET @sql = N'INSERT INTO ' + QUOTENAME(@head) + N' (单据编号, 单据日期, 单据状态, ' + @cols + N')'
             + N' SELECT N''' + @new + N''', ''2026-10-16'', N''草稿'', ' + @cols
             + N' FROM ' + QUOTENAME(@head) + N' WHERE 单据编号 = N''' + @src + N''';';
    EXEC sp_executesql @sql;
    SELECT @cols = STUFF((SELECT N', ' + QUOTENAME(c.name) FROM sys.columns c
       WHERE c.object_id = OBJECT_ID(@line) AND c.name <> N'id' AND c.name <> N'单据编号'
       ORDER BY c.column_id FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N'');
    SET @sql = N'INSERT INTO ' + QUOTENAME(@line) + N' (单据编号, ' + @cols + N')'
             + N' SELECT N''' + @new + N''', ' + @cols + N' FROM ' + QUOTENAME(@line) + N' WHERE 单据编号 = N''' + @src + N''';';
    EXEC sp_executesql @sql;
    PRINT N'材料出库:复制 ' + @src + N' → ' + @new;
  END
END

/* ---------- ② 销售出库单 ---------- */
SET @head = N'bd_sale_out'; SET @line = N'bl_sale_out';
SET @new = N'SO-TEST-0001';
IF NOT EXISTS (SELECT 1 FROM bd_sale_out WHERE 单据编号 = @new)
BEGIN
  SELECT TOP 1 @src = 单据编号 FROM bd_sale_out WHERE ISNULL(asp_cancel,'N') <> 'Y' ORDER BY id DESC;
  IF @src IS NOT NULL
  BEGIN
    SELECT @cols = STUFF((SELECT N', ' + QUOTENAME(c.name) FROM sys.columns c
       WHERE c.object_id = OBJECT_ID(@head) AND c.name <> N'id' AND c.name NOT IN (N'单据编号', N'单据日期', N'单据状态')
       ORDER BY c.column_id FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N'');
    SET @sql = N'INSERT INTO ' + QUOTENAME(@head) + N' (单据编号, 单据日期, 单据状态, ' + @cols + N')'
             + N' SELECT N''' + @new + N''', ''2026-10-16'', N''草稿'', ' + @cols
             + N' FROM ' + QUOTENAME(@head) + N' WHERE 单据编号 = N''' + @src + N''';';
    EXEC sp_executesql @sql;
    SELECT @cols = STUFF((SELECT N', ' + QUOTENAME(c.name) FROM sys.columns c
       WHERE c.object_id = OBJECT_ID(@line) AND c.name <> N'id' AND c.name <> N'单据编号'
       ORDER BY c.column_id FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, N'');
    SET @sql = N'INSERT INTO ' + QUOTENAME(@line) + N' (单据编号, ' + @cols + N')'
             + N' SELECT N''' + @new + N''', ' + @cols + N' FROM ' + QUOTENAME(@line) + N' WHERE 单据编号 = N''' + @src + N''';';
    EXEC sp_executesql @sql;
    PRINT N'销售出库:复制 ' + @src + N' → ' + @new;
  END
END

SELECT N'副本行数' AS k,
 (SELECT COUNT(*) FROM bd_material_out WHERE 单据编号 = N'CL-TEST-0001') AS 材料头,
 (SELECT COUNT(*) FROM bl_material_out WHERE 单据编号 = N'CL-TEST-0001') AS 材料行,
 (SELECT COUNT(*) FROM bd_sale_out     WHERE 单据编号 = N'SO-TEST-0001') AS 销售头,
 (SELECT COUNT(*) FROM bl_sale_out     WHERE 单据编号 = N'SO-TEST-0001') AS 销售行;
