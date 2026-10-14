/* ============================================================
   migrate-doc-image-col-width-20261014.sql — 2026-10-14
   「存货图片」列加宽到 nvarchar(500)(金蝶 picture 是 OSS 长 URL,实测 297~303 字符)

   背景:拉取 9/1 至今单据时,产品入库单有 2 张整单失败,报
     `String or binary data would be truncated` —— 定位:金蝶分录 `picture` 实测 **297/303 字符**,
     而 bl_finish_in.[存货图片] 是 nvarchar(200)(sys.columns.max_length 返回的是**字节**,400 字节=200 字符,
     别被 400 迷惑),bl_purchase_in 同样是 200;Phase 2 新建的 bl_other_in 我给的是 300(仍可能不够)。

   动作:把三张行表的 [存货图片] 统一加宽到 **nvarchar(500)**(幂等:仅当当前宽度 < 500 字符时才 ALTER;
     nvarchar 加宽是元数据级变更,不重写数据,秒级完成)。

   ⚠ 除本脚本外,拉取脚本 `_pull-kingdee-docs-1014.mjs` 另按目标列宽做**超长截断兜底**
     (单条超长值不再拖垮整单,并在报告里计数),两层一起用:列宽治本、截断兜底。
   两账套均执行。
   ============================================================ */
SET NOCOUNT ON;
GO
DECLARE @tbl sysname, @sql nvarchar(400);
DECLARE cur CURSOR FOR
  SELECT t.name FROM sys.tables t
   JOIN sys.columns c ON c.object_id = t.object_id AND c.name = N'存货图片'
   JOIN sys.types ty ON ty.user_type_id = c.user_type_id AND ty.name = N'nvarchar'
  WHERE t.name IN ('bl_finish_in', 'bl_purchase_in', 'bl_other_in') AND c.max_length < 1000;   -- 1000 字节 = 500 字符
OPEN cur;
FETCH NEXT FROM cur INTO @tbl;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tbl) + N' ALTER COLUMN [存货图片] nvarchar(500) NULL;';
  EXEC sp_executesql @sql;
  PRINT N'已加宽 ' + @tbl + N'.[存货图片] → nvarchar(500)';
  FETCH NEXT FROM cur INTO @tbl;
END
CLOSE cur; DEALLOCATE cur;
GO
-- 自检:三张表都必须 ≥ 500 字符(1000 字节)
DECLARE @bad int = 0;
IF (SELECT c.max_length FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bl_finish_in') AND c.name = N'存货图片') < 1000 SET @bad = @bad + 1;
IF (SELECT c.max_length FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bl_purchase_in') AND c.name = N'存货图片') < 1000 SET @bad = @bad + 1;
IF (SELECT c.max_length FROM sys.columns c WHERE c.object_id = OBJECT_ID('dbo.bl_other_in') AND c.name = N'存货图片') < 1000 SET @bad = @bad + 1;
IF @bad > 0 RAISERROR(N'存货图片 列宽自检失败(%d 张表仍 < 500 字符)', 16, 1, @bad);
ELSE PRINT N'存货图片 列宽就绪(nvarchar(500);幂等)';
GO
