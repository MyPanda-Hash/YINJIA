SET NOCOUNT ON;
/* 目的:把「工单ID / 工单项次」这个列名在当前库里到底还有谁在用,查成一张证据表。
   —— 列(物理)、面板字段(yj_field)、视图/过程/函数/触发器(定义串)、翻译词条、
      以及 inh/outh 这列的实际数据分布。用 _Q.java 逐库跑。
   ⚠ 直接写 [工单ID] 会让整批编译失败(列不存在)→ 凡带列名的都用动态 SQL。 */
DECLARE @db sysname = DB_NAME(), @sql nvarchar(max);

/* ① 任何名字里带「工单」的物理列 */
SELECT @db AS 库, t.name AS 表, c.name AS 列, ty.name AS 类型,
       CASE WHEN ty.name IN (N'nvarchar', N'nchar') THEN c.max_length / 2 ELSE c.max_length END AS 长,
       c.precision AS 精度, c.is_nullable AS 可空, c.column_id AS 列序,
       dc.definition AS 默认值
FROM sys.tables t
JOIN sys.columns c ON c.object_id = t.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
LEFT JOIN sys.default_constraints dc ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
WHERE c.name LIKE N'%工单%'
ORDER BY t.name, c.column_id;

/* ② 视图/存储过程/函数/触发器 定义里提到 工单ID 或 工单项次 的 */
SELECT @db AS 库, o.name AS 对象, o.type_desc AS 种类
FROM sys.sql_modules m JOIN sys.objects o ON o.object_id = m.object_id
WHERE m.definition LIKE N'%工单ID%' OR m.definition LIKE N'%工单项次%'
ORDER BY o.name;

/* ③ 面板字段登记(yj_field):列名/标签命中「工单」 */
IF OBJECT_ID(N'dbo.yj_field') IS NOT NULL
  SELECT @db AS 库, panel_code, seq, col_name, label, place, data_type, visible, hidden, ref_panel, ref_field
  FROM dbo.yj_field
  WHERE col_name LIKE N'%工单%' OR label LIKE N'%工单%'
  ORDER BY panel_code, seq;

/* ⑤ 翻译表里有没有这两个词条 */
IF OBJECT_ID(N'dbo.yj_translation') IS NOT NULL
  SELECT @db AS 库, scope, ref_key, locale, text
  FROM dbo.yj_translation WHERE ref_key IN (N'工单ID', N'工单项次', N'工单号') ORDER BY ref_key, locale;

/* ⑥ inh/outh 实际数据(动态 SQL:列可能不存在) */
SET @sql = N'';
IF OBJECT_ID(N'dbo.inh') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.inh', N'工单项次') IS NOT NULL
    SET @sql = @sql + N'SELECT @d AS 库, N''inh.工单项次'' AS 对象, COUNT(*) AS 行数, SUM(CASE WHEN [工单项次] IS NULL THEN 1 ELSE 0 END) AS 空值, MIN([工单项次]) AS 最小, MAX([工单项次]) AS 最大 FROM dbo.inh;';
  IF COL_LENGTH(N'dbo.inh', N'工单ID') IS NOT NULL
    SET @sql = @sql + N'SELECT @d AS 库, N''inh.工单ID'' AS 对象, COUNT(*) AS 行数, SUM(CASE WHEN [工单ID] IS NULL THEN 1 ELSE 0 END) AS 空值, MIN([工单ID]) AS 最小, MAX([工单ID]) AS 最大 FROM dbo.inh;';
  IF COL_LENGTH(N'dbo.inh', N'pl_xc') IS NOT NULL
    SET @sql = @sql + N'SELECT @d AS 库, N''inh.pl_xc'' AS 对象, COUNT(*) AS 行数, SUM(CASE WHEN [pl_xc] IS NULL THEN 1 ELSE 0 END) AS 空值, MIN([pl_xc]) AS 最小, MAX([pl_xc]) AS 最大 FROM dbo.inh;';
END
IF OBJECT_ID(N'dbo.outh') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.outh', N'工单项次') IS NOT NULL
    SET @sql = @sql + N'SELECT @d AS 库, N''outh.工单项次'' AS 对象, COUNT(*) AS 行数, SUM(CASE WHEN [工单项次] IS NULL THEN 1 ELSE 0 END) AS 空值, MIN([工单项次]) AS 最小, MAX([工单项次]) AS 最大 FROM dbo.outh;';
  IF COL_LENGTH(N'dbo.outh', N'工单ID') IS NOT NULL
    SET @sql = @sql + N'SELECT @d AS 库, N''outh.工单ID'' AS 对象, COUNT(*) AS 行数, SUM(CASE WHEN [工单ID] IS NULL THEN 1 ELSE 0 END) AS 空值, MIN([工单ID]) AS 最小, MAX([工单ID]) AS 最大 FROM dbo.outh;';
  IF COL_LENGTH(N'dbo.outh', N'pl_xc') IS NOT NULL
    SET @sql = @sql + N'SELECT @d AS 库, N''outh.pl_xc'' AS 对象, COUNT(*) AS 行数, SUM(CASE WHEN [pl_xc] IS NULL THEN 1 ELSE 0 END) AS 空值, MIN([pl_xc]) AS 最小, MAX([pl_xc]) AS 最大 FROM dbo.outh;';
END
IF LEN(@sql) > 0 EXEC sp_executesql @sql, N'@d sysname', @d = @db;
